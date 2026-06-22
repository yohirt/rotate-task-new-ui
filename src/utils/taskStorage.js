export const TASKS_STORAGE_KEY = "rotate.tasks.v1";
export const RUNNING_SESSION_STORAGE_KEY = "rotate.running-session.v1";
export const TASKS_DEFINITION_SIGNATURE_STORAGE_KEY =
  "rotate.tasks-definition-signature.v1";

function getTasksDefinitionSignature(tasks) {
  return JSON.stringify(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      icon: task.icon,
      time: task.time,
      targetMinutes: task.targetMinutes,
      description: task.description,
      subtasks: (task.subtasks || []).map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        targetMinutes: subtask.targetMinutes,
      })),
    }))
  );
}

export function loadTasks(fallbackTasks) {
  try {
    const fallbackSignature = getTasksDefinitionSignature(fallbackTasks);
    const storedSignature = localStorage.getItem(
      TASKS_DEFINITION_SIGNATURE_STORAGE_KEY
    );
    const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
    const parsedTasks = storedTasks ? JSON.parse(storedTasks) : null;
    const hasStoredTasks = Array.isArray(parsedTasks);

    if (storedSignature !== fallbackSignature) {
      localStorage.setItem(
        TASKS_DEFINITION_SIGNATURE_STORAGE_KEY,
        fallbackSignature
      );
      return hasStoredTasks ? parsedTasks : fallbackTasks;
    }

    if (!hasStoredTasks) {
      return fallbackTasks;
    }

    return parsedTasks;
  } catch {
    return fallbackTasks;
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

export function loadRunningSession() {
  try {
    const storedSession = localStorage.getItem(RUNNING_SESSION_STORAGE_KEY);
    if (!storedSession) {
      return null;
    }

    const parsedSession = JSON.parse(storedSession);
    if (!parsedSession || !parsedSession.taskId || !parsedSession.startTime) {
      return null;
    }

    return parsedSession;
  } catch {
    return null;
  }
}

export function saveRunningSession(session) {
  localStorage.setItem(RUNNING_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearRunningSession() {
  localStorage.removeItem(RUNNING_SESSION_STORAGE_KEY);
}
