// Best-effort background processing. Android decides when this runs (at most every ~15 minutes,
// and only with battery and network available), so the app also processes screenshots whenever
// it is opened. This file must be imported once at startup (index.ts) so the task is defined.
// The native modules are loaded defensively so the app still opens in Expo Go, where background
// tasks may be unavailable.
import { flushSaves, getState, hydrate } from '../store';
import { processQueue, scanInbox } from './inbox';
import { notifyReady } from './notify';

export const TASK_NAME = 'anime-inbox-process';

let TaskManager: any = null;
let BackgroundTask: any = null;
try {
  TaskManager = require('expo-task-manager');
  BackgroundTask = require('expo-background-task');
} catch {
  TaskManager = null;
  BackgroundTask = null;
}

try {
  if (TaskManager && BackgroundTask) {
    TaskManager.defineTask(TASK_NAME, async () => {
      try {
        await hydrate();
        if (!getState().settings.backgroundProcessing) return BackgroundTask.BackgroundTaskResult.Success;
        await scanInbox();
        const n = await processQueue();
        if (n > 0 && getState().settings.notifyOnReady) await notifyReady(n);
        await flushSaves();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  }
} catch {
  // background tasks are optional
}

export async function syncBackgroundRegistration(enabled: boolean): Promise<void> {
  if (!TaskManager || !BackgroundTask) return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (enabled && !registered) await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 15 });
    if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(TASK_NAME);
  } catch {
    // background tasks are optional
  }
}
