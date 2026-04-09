/**
 * Background Service Worker
 * 负责任务编排、队列管理、跨平台发布等
 */

import { db, type Job } from '@synccaster/core';
import { Logger } from '@synccaster/utils';
import { startZhihuLearn, fetchZhihuLearnedTemplate } from './learn-recorder';
import { AccountService } from './account-service';
import { fetchPlatformUserInfo } from './platform-api';
import { publishWechatFromMdEditor } from './wechat-md-publish';
import {
  cancelJob as cancelManagedJob,
  createJob as createManagedJob,
  getJobStatus as getManagedJobStatus,
  processScheduledJobs as processManagedScheduledJobs,
  startJob as startManagedJob,
} from './job-service';
import { initNativeAgentBridge } from './native-agent-bridge';

const logger = new Logger('background');

// 动态导入 v2.0 处理器，避免阻塞启动
let processCollectedHTML: any = null;
try {
  import('./content-processor-v2').then((module) => {
    processCollectedHTML = module.processCollectedHTML;
    logger.info('v2', 'v2.0 processor loaded successfully');
  }).catch((error) => {
    logger.warn('v2', 'Failed to load v2.0 processor, will use v1.0 only', { error: error.message });
  });
} catch (error: any) {
  logger.warn('v2', 'v2.0 processor import failed', { error: error.message });
}

// 初始化账号服务（监听登录成功消息）
AccountService.init();
initNativeAgentBridge();

// 监听扩展安装
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('install', `Extension installed: ${details.reason}`);
  
  if (details.reason === 'install') {
    // 初始化数据库
    await initializeDatabase();
    
    // 打开欢迎页
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/ui/options/index.html'),
    });
  }
});

// 监听来自 popup/options/content-script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('message', `Received message: ${message.type}`, { message, sender });
  
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      logger.error('message', 'Message handling failed', { error });
      sendResponse({ error: error.message });
    });
  
  // 返回 true 表示异步响应
  return true;
});

// 监听定时器（用于排期发布）
chrome.alarms.onAlarm.addListener(async (alarm) => {
  logger.info('alarm', `Alarm triggered: ${alarm.name}`);
  
  if (alarm.name === 'check-scheduled-jobs') {
    await processManagedScheduledJobs();
  }
});

// 设置定时检查排期任务（每分钟检查一次）
chrome.alarms.create('check-scheduled-jobs', {
  periodInMinutes: 1,
});

/**
 * 初始化数据库
 */
async function initializeDatabase() {
  logger.info('init', 'Initializing database');
  
  try {
    // 测试数据库连接
    await db.open();
    logger.info('init', 'Database initialized successfully');
  } catch (error) {
    logger.error('init', 'Database initialization failed', { error });
  }
}

/**
 * 保存采集的文章到数据库（v2.0 增强版）
 */
async function saveCollectedPost(data: any) {
  try {
    const now = Date.now();
    const id = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? crypto.randomUUID()
      : `${now}-${Math.random().toString(36).slice(2, 8)}`;

    let v2Enhanced = null;
    
    // 🚀 尝试使用 v2.0 处理器增强内容（如果可用）
    if (data?.body_html && processCollectedHTML) {
      logger.info('v2', 'Processing content with v2.0 pipeline');
      
      try {
        const v2Result = await processCollectedHTML(
          data.body_html,
          { 
            title: data.title || '未命名标题', 
            url: data.url || '' 
          },
          {
            downloadImages: true,
            platforms: ['juejin', 'csdn', 'zhihu', 'wechat'],
            onProgress: (stage: string, progress: number) => {
              logger.debug('v2-progress', `${stage}: ${(progress * 100).toFixed(0)}%`);
            },
          }
        );

        if (v2Result.success && v2Result.data) {
          v2Enhanced = v2Result.data;
          logger.info('v2', 'v2.0 processing successful', {
            imageCount: v2Enhanced.manifest.images.length,
            formulaCount: v2Enhanced.manifest.formulas.length,
            platforms: Object.keys(v2Enhanced.adaptedContent).length,
          });
        }
      } catch (error: any) {
        logger.warn('v2', 'v2.0 processing failed, falling back to v1.0', { error: error.message });
      }
    } else if (data?.body_html && !processCollectedHTML) {
      logger.info('v2', 'v2.0 processor not loaded, using v1.0');
    }

    // 构建资产列表（优先使用 v2.0 的增强数据）
    const assets = v2Enhanced?.manifest.images.map((img: any, idx: number) => ({
      id: `${id}-img-${idx}`,
      type: 'image',
      url: img.proxyUrl || img.originalUrl,
      alt: img.metadata?.alt,
      title: img.metadata?.title,
      width: img.metadata?.width,
      height: img.metadata?.height,
      hash: img.id,
      variants: img.optimized ? {
        webp: img.optimized.webp?.url,
      } : undefined,
    })) || (Array.isArray(data?.images)
      ? data.images.map((img: any, idx: number) => ({
          id: `${id}-img-${idx}`,
          type: 'image',
          url: img?.url || '',
          alt: img?.alt || undefined,
          title: img?.title || undefined,
          width: img?.width || undefined,
          height: img?.height || undefined,
        }))
      : []);

    const post = {
      id,
      version: v2Enhanced ? 2 : 1, // 标记版本
      title: data?.title || '未命名标题',
      summary: v2Enhanced?.metadata ? 
        (data.summary || `${v2Enhanced.metadata.wordCount} 字，${v2Enhanced.metadata.imageCount} 图`) :
        (data?.summary || ''),
      canonicalUrl: data?.url || '',
      createdAt: now,
      updatedAt: now,
      body_md: v2Enhanced?.markdown || data?.body_md || '',
      tags: [],
      categories: [],
      assets,
      meta: {
        source_url: data?.url || '',
        collected_at: new Date(now).toISOString(),
        body_html: data?.body_html || '',
        // v2.0 增强数据
        ...(v2Enhanced ? {
          v2: {
            ast: v2Enhanced.ast,
            manifest: v2Enhanced.manifest,
            adaptedContent: v2Enhanced.adaptedContent,
            metadata: v2Enhanced.metadata,
          },
        } : {}),
      },
    } as any;

    await db.posts.add(post);
    
    logger.info('db', 'Post saved', { 
      id: post.id, 
      title: post.title, 
      version: post.version,
      len: post.body_md?.length || 0,
      images: assets.length,
      v2Enhanced: !!v2Enhanced,
    });
    
    return { 
      success: true, 
      postId: post.id,
      v2Enhanced: !!v2Enhanced,
    };
  } catch (error: any) {
    logger.error('db', 'Save post failed', { error });
    return { success: false, error: error?.message || 'Save failed' };
  }
}

/**
 * 处理消息
 */
async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'CREATE_JOB':
      return await createManagedJob(message.data);
    
    case 'START_JOB':
      return await startManagedJob(message.data.jobId);
    
    case 'CANCEL_JOB':
      return await cancelManagedJob(message.data.jobId);
    
    case 'GET_JOB_STATUS':
      return await getManagedJobStatus(message.data.jobId);
    
    case 'COLLECT_CONTENT':
      // 请求 content script 采集内容
      if (sender.tab?.id) {
        return await collectContentFromTab(sender.tab.id);
      }
      throw new Error('No tab context');

    case 'SAVE_POST':
      // 保存采集结果到本地数据库
      logger.info('save', 'Saving post', { title: message.data?.title });
      try {
        const result = await saveCollectedPost(message.data);
        logger.info('save', 'Save result', result);
        return result;
      } catch (error: any) {
        logger.error('save', 'Save failed', { error });
        return { success: false, error: error.message };
      }

    case 'FETCH_PLATFORM_USER_INFO':
      // 供 content script 查询登录态（部分平台需要避免页面侧 API 调用）
      try {
        const platform = message.data?.platform;
        if (!platform || typeof platform !== 'string') {
          return { success: false, error: 'Invalid platform' };
        }
        const info = await fetchPlatformUserInfo(platform);
        return { success: true, info };
      } catch (error: any) {
        logger.error('account', 'Failed to fetch platform user info', { error });
        return { success: false, error: error.message };
      }

    case 'ADD_ACCOUNT':
      // 添加账号
      logger.info('account', 'Adding account', { platform: message.data?.platform });
      try {
        const account = await AccountService.addAccount(message.data.platform);
        logger.info('account', 'Account added', { account });
        return { success: true, account };
      } catch (error: any) {
        logger.error('account', 'Failed to add account', { error });
        return { success: false, error: error.message };
      }

    case 'QUICK_ADD_ACCOUNT':
      // 快速添加账号（用户已登录）
      logger.info('account', 'Quick adding account', { platform: message.data?.platform });
      try {
        const account = await AccountService.quickAddAccount(message.data.platform);
        logger.info('account', 'Account quick added', { account });
        return { success: true, account };
      } catch (error: any) {
        logger.error('account', 'Failed to quick add account', { error });
        return { success: false, error: error.message };
      }

    case 'DELETE_ALL_ACCOUNTS':
      // 一键删除所有账号（开发测试用）
      logger.info('account', 'Deleting all accounts');
      try {
        const count = await db.accounts.count();
        await db.accounts.clear();
        logger.info('account', 'All accounts deleted', { count });
        return { success: true, deletedCount: count };
      } catch (error: any) {
        logger.error('account', 'Failed to delete all accounts', { error });
        return { success: false, error: error.message };
      }

    case 'CHECK_ACCOUNT_AUTH':
      // 检查账号认证状态
      try {
        const isValid = await AccountService.checkAccountAuth(message.data.account);
        return { success: true, isValid };
      } catch (error: any) {
        logger.error('account', 'Failed to check account auth', { error });
        return { success: false, error: error.message };
      }

    case 'REFRESH_ACCOUNT':
      // 刷新账号信息
      try {
        const account = await AccountService.refreshAccount(message.data.account);
        return { success: true, account };
      } catch (error: any) {
        logger.error('account', 'Failed to refresh account', { error });
        return { success: false, error: error.message };
      }

    case 'DEDUP_ACCOUNTS':
      // 清理重复账号并修正引用（无 UI）
      logger.info('account', 'Deduplicating accounts');
      try {
        await AccountService.deduplicateAccountsByPlatform();
        return { success: true };
      } catch (error: any) {
        logger.error('account', 'Failed to deduplicate accounts', { error });
        return { success: false, error: error.message };
      }

    case 'REFRESH_ALL_ACCOUNTS_FAST':
      // 批量快速刷新所有账号（并行，无需打开标签页）
      logger.info('account', 'Fast refreshing all accounts', { count: message.data?.accounts?.length });
      try {
        const result = await AccountService.refreshAllAccountsFast(message.data.accounts);
        return {
          success: true,
          successCount: result.success.length,
          failedCount: result.failed.length,
          successAccounts: result.success,
          failedAccounts: result.failed,
        };
      } catch (error: any) {
        logger.error('account', 'Failed to refresh all accounts', { error });
        return { success: false, error: error.message };
      }

    case 'RELOGIN_ACCOUNT':
      // 重新登录账号（打开登录页面，轮询检测登录成功）
      // Requirements: 4.2
      logger.info('account', 'Re-login account', { platform: message.data?.account?.platform });
      try {
        const account = await AccountService.reloginAccount(message.data.account);
        logger.info('account', 'Re-login successful', { account });
        return { success: true, account };
      } catch (error: any) {
        logger.error('account', 'Failed to re-login account', { error });
        return { success: false, error: error.message };
      }

    case 'LAZY_CHECK_ACCOUNT':
      // 懒加载检测账号状态（用户选择平台时才检测）
      logger.info('account', 'Lazy check account', { platform: message.data?.account?.platform });
      try {
        const result = await AccountService.lazyCheckAccount(
          message.data.account, 
          message.data.forceCheck
        );
        return { success: true, ...result };
      } catch (error: any) {
        logger.error('account', 'Failed to lazy check account', { error });
        return { success: false, error: error.message };
      }

    case 'LAZY_CHECK_ACCOUNTS':
      // 批量懒加载检测
      logger.info('account', 'Lazy check accounts', { count: message.data?.accounts?.length });
      try {
        const result = await AccountService.lazyCheckAccounts(message.data.accounts);
        return { success: true, ...result };
      } catch (error: any) {
        logger.error('account', 'Failed to lazy check accounts', { error });
        return { success: false, error: error.message };
      }

    case 'AUTO_OPEN_LOGIN_PAGE':
      // 自动打开登录页面
      logger.info('account', 'Auto open login page', { platform: message.data?.account?.platform });
      try {
        const result = await AccountService.autoOpenLoginPage(
          message.data.account,
          message.data.options
        );
        return { success: result.success, tabId: result.tabId };
      } catch (error: any) {
        logger.error('account', 'Failed to auto open login page', { error });
        return { success: false, error: error.message };
      }

    case 'GET_MANUAL_PUBLISH_URL':
      // 获取手动发布 URL
      try {
        const url = AccountService.getManualPublishUrl(message.data.platform);
        return { success: true, url };
      } catch (error: any) {
        return { success: false, error: error.message };
      }

    case 'OPEN_MANUAL_PUBLISH_PAGE':
      // 打开手动发布页面
      logger.info('account', 'Open manual publish page', { platform: message.data?.platform });
      try {
        const opened = await AccountService.openManualPublishPage(message.data.platform);
        return { success: opened };
      } catch (error: any) {
        logger.error('account', 'Failed to open manual publish page', { error });
        return { success: false, error: error.message };
      }

    case 'QUICK_STATUS_CHECK':
      // 快速状态检测（仅检测 Cookie 存在性，不调用 API）
      logger.info('account', 'Quick status check', { platform: message.data?.account?.platform });
      try {
        const result = await AccountService.quickStatusCheck(message.data.account);
        return { success: true, ...result };
      } catch (error: any) {
        logger.error('account', 'Failed to quick status check', { error });
        return { success: false, error: error.message };
      }

    case 'QUICK_STATUS_CHECK_ALL':
      // 批量快速状态检测
      logger.info('account', 'Quick status check all', { count: message.data?.accounts?.length });
      try {
        const results = await AccountService.quickStatusCheckAll(message.data.accounts);
        // 将 Map 转换为普通对象以便序列化
        const resultsObj: Record<string, any> = {};
        results.forEach((value, key) => {
          resultsObj[key] = value;
        });
        return { success: true, results: resultsObj };
      } catch (error: any) {
        logger.error('account', 'Failed to quick status check all', { error });
        return { success: false, error: error.message };
      }

    case 'SHOULD_REFRESH_ACCOUNT':
      // 判断账号是否需要刷新
      try {
        const result = await AccountService.shouldRefreshAccount(
          message.data.account,
          message.data.options
        );
        return { success: true, ...result };
      } catch (error: any) {
        logger.error('account', 'Failed to check should refresh', { error });
        return { success: false, error: error.message };
      }

    case 'SMART_REFRESH_ACCOUNT':
      // 智能刷新账号（根据条件决定是否刷新）
      logger.info('account', 'Smart refresh account', { platform: message.data?.account?.platform });
      try {
        const result = await AccountService.smartRefreshAccount(
          message.data.account,
          message.data.options
        );
        return { success: true, ...result };
      } catch (error: any) {
        logger.error('account', 'Failed to smart refresh account', { error });
        return { success: false, error: error.message };
      }

    case 'CHECK_ACCOUNT_EXPIRATION':
      // 检查账号是否过期或即将过期
      try {
        const result = AccountService.isAccountExpiredOrExpiring(message.data.account);
        return { success: true, ...result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }

    case 'CONTENT_COLLECTED':
      // 内容采集完成的通知
      logger.info('collect', 'Content collected successfully', message.data);
      
      let saved: any = { success: false };
      if (message.data?.success && message.data?.data) {
        // 保存文章
        saved = await saveCollectedPost(message.data.data);
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
          title: saved.success ? '采集成功并已保存' : '采集成功但保存失败',
          message: `文章：${message.data.data?.title || '未知标题'}`,
        });
      }
      
      return { received: true, saved };

    case 'WECHAT_PUBLISH_FROM_MD_EDITOR':
      // md-editor 点击「发布到微信」后触发：打开公众号发文页并自动填充标题/正文
      logger.info('wechat', 'Publish from md-editor', {
        title: message.data?.title,
        contentLength: message.data?.content?.length,
      });
      return await publishWechatFromMdEditor(message.data);

    case 'START_PUBLISH_JOB':
      // 启动发布任务
      logger.info('publish', 'Starting publish job', { jobId: message.data?.jobId });
      try {
        await startManagedJob(message.data.jobId);
        return { success: true };
      } catch (error: any) {
        logger.error('publish', 'Failed to start publish job', { error });
        return { success: false, error: error.message };
      }

    case 'START_ZHIHU_LEARN':
      logger.info('learn', 'Starting Zhihu learn mode');
      try {
        const r = await startZhihuLearn();
        return r;
      } catch (error: any) {
        logger.error('learn', 'Failed to start learn mode', { error });
        return { success: false, error: error.message };
      }

    case 'FETCH_ZHIHU_TEMPLATE':
      logger.info('learn', 'Fetching Zhihu learned template');
      try {
        const r = await fetchZhihuLearnedTemplate();
        if (r.success) {
          await db.config.put({ id: 'zhihu_template', key: 'zhihu_template', value: r.records, updatedAt: Date.now() } as any);
        }
        return r;
      } catch (error: any) {
        logger.error('learn', 'Failed to fetch/template', { error });
        return { success: false, error: error.message };
      }
    
    case 'LOGIN_STATE_REPORT':
      // 来自 content script 的登录状态报告（页面加载时自动报告）
      logger.info('auth', 'Login state report received', message.data);
      return { received: true };
    
    case 'LOGIN_SUCCESS':
      // 来自 content script 的登录成功通知
      logger.info('auth', 'Login success notification received', message.data);
      return { received: true };
    
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * 创建发布任务
 */
async function createJob(data: { postId: string; targets: any[] }) {
  return createManagedJob(data);
}

/**
 * 启动任务
 */
async function startJob(jobId: string) {
  return startManagedJob(jobId);
}

/**
 * 取消任务
 */
async function cancelJob(jobId: string) {
  return cancelManagedJob(jobId);
}

/**
 * 获取任务状态
 */
async function getJobStatus(jobId: string) {
  return getManagedJobStatus(jobId);
}

/**
 * 从标签页采集内容
 */
async function collectContentFromTab(tabId: number) {
  logger.info('collect', `Collecting content from tab: ${tabId}`);
  
  const result = await chrome.tabs.sendMessage(tabId, {
    type: 'COLLECT_CONTENT',
  });
  
  return result;
}

logger.info('startup', 'Background service worker started');
