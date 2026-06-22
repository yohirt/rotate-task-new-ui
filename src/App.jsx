import { useCallback, useEffect, useRef, useState } from "react";
import TaskPanel from "./components/TaskPanel";
import StatsPanel from "./components/StatsPanel";
import TaskWheel from "./components/TaskWheel";
import SubtaskWheel from "./components/SubtaskWheel";
import { initialTasks } from "./data/initialTasks";
import { ICON_OPTIONS } from "./data/taskIcons";
import { getTaskColor } from "./utils/taskColors";
import {
  loadTasks,
  saveTasks,
  loadRunningSession,
  saveRunningSession,
  clearRunningSession,
} from "./utils/taskStorage";
import {
  calculateElapsedSeconds,
  createSession,
  endSession,
  addSessionToTask,
  getTargetSeconds,
  getTimeProgressPercent,
  formatDuration,
} from "./utils/sessionTracker";
import "./App.css";
import "./App.dark.css";

const formatHeaderDate = (date) =>
  date.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const formatHeaderTime = (date) =>
  date.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

const INSTALL_PROMPT_READY_EVENT = "rotate:install-prompt-ready";
const THEME_STORAGE_KEY = "rotate.theme.v1";
const UI_STATE_STORAGE_KEY = "rotate.ui-state.v1";
const CYCLE_START_STORAGE_KEY = "rotate.cycle-start.v1";
let pendingInstallPrompt = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pendingInstallPrompt = event;
    window.dispatchEvent(new Event(INSTALL_PROMPT_READY_EVENT));
  });
}

const emptyTaskForm = {
  title: "",
  icon: "\u{1F3AF}",
  targetMinutes: "30",
  description: "",
};

const createTaskFromForm = (form, nextId) => ({
  id: nextId,
  title: form.title.trim() || "Nowy task",
  icon: form.icon.trim() || "\u{1F3AF}",
  time: "",
  targetMinutes: Math.max(0, Number(form.targetMinutes) || 0),
  description: form.description.trim(),
  done: false,
  hidden: false,
  subtasks: [],
  sessions: [],
});

const resetTaskForCycle = (task, resetAt) => ({
  ...task,
  done: false,
  cycleResetAt: resetAt.toISOString(),
  subtasks: (task.subtasks || []).map((subtask) => ({
    ...subtask,
    done: false,
  })),
});

const resetTaskCycleMarker = (task) => {
  const { cycleResetAt, ...taskWithoutCycleReset } = task;

  return {
    ...taskWithoutCycleReset,
    done: false,
    subtasks: (task.subtasks || []).map((subtask) => ({
      ...subtask,
      done: false,
    })),
  };
};

const TASK_SOUND_ALERTS = [
  { thresholdSeconds: 5 * 60, beepCount: 5 },
  { thresholdSeconds: 3 * 60, beepCount: 3 },
  { thresholdSeconds: 2 * 60, beepCount: 2 },
  { thresholdSeconds: 60, beepCount: 1 },
];

const loadUiState = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedState = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!storedState) {
      return null;
    }

    const parsedState = JSON.parse(storedState);
    return parsedState && typeof parsedState === "object" ? parsedState : null;
  } catch {
    return null;
  }
};

const saveUiState = (uiState) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    UI_STATE_STORAGE_KEY,
    JSON.stringify({
      ...uiState,
      savedAt: new Date().toISOString(),
    })
  );
};

const getStartOfLocalDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const loadCycleStartTime = () => {
  if (typeof window === "undefined") {
    return getStartOfLocalDay(new Date());
  }

  try {
    const storedCycleStart = window.localStorage.getItem(CYCLE_START_STORAGE_KEY);
    if (storedCycleStart) {
      const parsedDate = new Date(storedCycleStart);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
  } catch {
    // Fall through to initializing the current cycle.
  }

  const initialCycleStart = getStartOfLocalDay(new Date());
  window.localStorage.setItem(
    CYCLE_START_STORAGE_KEY,
    initialCycleStart.toISOString()
  );
  return initialCycleStart;
};

const saveCycleStartTime = (cycleStartTime) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    CYCLE_START_STORAGE_KEY,
    cycleStartTime.toISOString()
  );
};

const getSessionStartTime = (session) => {
  if (session?.startTime) {
    const parsedStart = new Date(session.startTime);
    if (!Number.isNaN(parsedStart.getTime())) {
      return parsedStart;
    }
  }

  if (session?.date) {
    const parsedDate = new Date(`${session.date}T00:00:00`);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return null;
};

const isSessionInCycle = (session, cycleStartTime) => {
  const sessionStartTime = getSessionStartTime(session);
  return (
    sessionStartTime !== null &&
    sessionStartTime.getTime() >= cycleStartTime.getTime()
  );
};

const getTaskCycleStartTime = (task, cycleStartTime) => {
  if (!task?.cycleResetAt) {
    return cycleStartTime;
  }

  const taskResetAt = new Date(task.cycleResetAt);
  if (Number.isNaN(taskResetAt.getTime())) {
    return cycleStartTime;
  }

  return taskResetAt.getTime() > cycleStartTime.getTime()
    ? taskResetAt
    : cycleStartTime;
};

const getCycleDuration = (task, cycleStartTime, subtaskId = undefined) => {
  const taskCycleStartTime = getTaskCycleStartTime(task, cycleStartTime);

  return (task.sessions || [])
    .filter((session) => {
      const matchesSubtask =
        subtaskId === undefined ? true : session.subtaskId === subtaskId;
      return matchesSubtask && isSessionInCycle(session, taskCycleStartTime);
    })
    .reduce((total, session) => {
      if (typeof session.durationSeconds === "number") {
        return total + session.durationSeconds;
      }

      if (typeof session.duration === "number") {
        return total + session.duration * 60;
      }

      return total;
    }, 0);
};

const getCycleSessions = (tasks, cycleStartTime) =>
  tasks.flatMap((task) => {
    const taskCycleStartTime = getTaskCycleStartTime(task, cycleStartTime);

    return (task.sessions || []).filter((session) =>
      isSessionInCycle(session, taskCycleStartTime)
    );
  });

function App() {
  const audioContextRef = useRef(null);
  const playedSoundKeysRef = useRef(new Set());
  const previousRemainingSecondsRef = useRef(null);
  const soundSessionKeyRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(() => pendingInstallPrompt);
  const [installNotice, setInstallNotice] = useState("");
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  });
  const [bootstrap] = useState(() => {
    const initialTasksState = loadTasks(initialTasks);
    const storedRunningSession = loadRunningSession();
    const storedUiState = loadUiState();

    const isStoredSessionValid = storedRunningSession
      ? initialTasksState.some(
          (task) =>
            task.id === storedRunningSession.taskId && !task.done && !task.hidden
        )
      : false;

    const resolvedRunningSession = isStoredSessionValid
      ? {
          ...storedRunningSession,
          subtaskId:
            storedRunningSession.subtaskId &&
            initialTasksState
              .find((task) => task.id === storedRunningSession.taskId)
              ?.subtasks.some(
                (subtask) => subtask.id === storedRunningSession.subtaskId
              )
              ? storedRunningSession.subtaskId
              : null,
        }
      : null;

    const visibleInitialTasks = initialTasksState.filter((task) => !task.hidden);
    const resolvedActiveIndex = resolvedRunningSession
      ? visibleInitialTasks.findIndex(
          (task) => task.id === resolvedRunningSession.taskId && !task.done
        )
      : storedUiState?.activeTaskId
      ? visibleInitialTasks.findIndex(
          (task) => task.id === storedUiState.activeTaskId
        )
      : visibleInitialTasks.findIndex((task) => !task.done);

    const safeActiveIndex = resolvedActiveIndex >= 0 ? resolvedActiveIndex : 0;
    const defaultTask = visibleInitialTasks[safeActiveIndex];

    const createdRunningSession =
      resolvedRunningSession || (defaultTask && !defaultTask.done
        ? {
            taskId: defaultTask.id,
            subtaskId: null,
            startTime: createSession(new Date()).startTime,
          }
        : null);

    return {
      initialTasksState,
      initialActiveIndex: safeActiveIndex,
      initialRunningSession: createdRunningSession,
      initialSessionStartTime: createdRunningSession
        ? new Date(createdRunningSession.startTime)
        : new Date(),
      initialActiveView:
        storedUiState?.activeView === "stats" ? "stats" : "today",
      initialShowSubWheel: Boolean(storedUiState?.showSubWheel),
    };
  });

  const [tasks, setTasks] = useState(bootstrap.initialTasksState);
  const [activeIndex, setActiveIndex] = useState(bootstrap.initialActiveIndex);
  const [showSubWheel, setShowSubWheel] = useState(
    bootstrap.initialShowSubWheel
  );
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState(emptyTaskForm);
  const [activeView, setActiveView] = useState(bootstrap.initialActiveView);
  const [runningSession, setRunningSession] = useState(
    bootstrap.initialRunningSession
  );
  const [sessionStartTime, setSessionStartTime] = useState(
    bootstrap.initialSessionStartTime
  );
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [cycleStartTime, setCycleStartTime] = useState(loadCycleStartTime);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextConstructor =
      window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playTone = useCallback((startOffset, duration, frequency = 880) => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startTime = audioContext.currentTime + startOffset;
    const endTime = startTime + duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
  }, [getAudioContext]);

  const playBeeps = useCallback((count) => {
    Array.from({ length: count }).forEach((_, index) => {
      playTone(index * 0.22, 0.11, 920);
    });
  }, [playTone]);

  const playCompletionSound = useCallback(() => {
    playTone(0, 0.75, 620);
    playTone(0.08, 0.65, 930);
  }, [playTone]);

  const playTaskSwitchSound = useCallback(() => {
    playTone(0, 0.08, 760);
  }, [playTone]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    saveCycleStartTime(cycleStartTime);
  }, [cycleStartTime]);

  useEffect(() => {
    if (runningSession) {
      saveRunningSession(runningSession);
      return;
    }

    clearRunningSession();
  }, [runningSession]);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(new Date());

    const interval = setInterval(updateCurrentTime, 1000);
    window.addEventListener("focus", updateCurrentTime);
    window.addEventListener("pageshow", updateCurrentTime);
    document.addEventListener("visibilitychange", updateCurrentTime);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", updateCurrentTime);
      window.removeEventListener("pageshow", updateCurrentTime);
      document.removeEventListener("visibilitychange", updateCurrentTime);
    };
  }, []);

  useEffect(() => {
    const handleInstallPromptReady = () => {
      setInstallPrompt(pendingInstallPrompt);
      setInstallNotice("");
    };

    const handleAppInstalled = () => {
      pendingInstallPrompt = null;
      setInstallPrompt(null);
      setIsInstalled(true);
      setInstallNotice("Aplikacja została zainstalowana.");
    };

    window.addEventListener(
      INSTALL_PROMPT_READY_EVENT,
      handleInstallPromptReady
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        INSTALL_PROMPT_READY_EVENT,
        handleInstallPromptReady
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    const isIos =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !window.navigator.standalone;

    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      pendingInstallPrompt = null;
      setInstallPrompt(null);

      setInstallNotice(
        choice.outcome === "accepted"
          ? "Instalacja rozpoczęta."
          : "Instalacja anulowana."
      );
      return;
    }

    setInstallNotice(
      isIos
        ? "Na iPhone: Udostępnij -> Dodaj do ekranu początkowego."
        : "Otwórz menu przeglądarki i wybierz Zainstaluj aplikację albo Dodaj do ekranu."
    );
  };

  const refreshPwaCache = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister())
        );
      }

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      pendingInstallPrompt = null;
      setInstallPrompt(null);
      setInstallNotice("Cache PWA odświeżony. Strona za chwilę się przeładuje.");

      window.setTimeout(() => {
        window.location.replace(
          `${window.location.pathname}?pwa-refresh=${Date.now()}`
        );
      }, 700);
    } catch {
      setInstallNotice(
        "Nie udało się odświeżyć PWA automatycznie. Spróbuj wyczyścić dane strony w przeglądarce."
      );
    }
  };

  const stopRunningSession = (endedAt) => {
    if (!runningSession) {
      return;
    }

    setTasks((prevTasks) => {
      const taskIndex = prevTasks.findIndex((task) => task.id === runningSession.taskId);
      if (taskIndex === -1) {
        return prevTasks;
      }

      const startedSession = createSession(
        new Date(runningSession.startTime),
        runningSession.subtaskId ?? null
      );
      const completedSession = endSession(startedSession, endedAt);

      return prevTasks.map((task, index) =>
        index === taskIndex ? addSessionToTask(task, completedSession) : task
      );
    });

    setRunningSession(null);
    clearRunningSession();
  };

  const startRunningSessionForTask = (taskId, startedAt, subtaskId = null) => {
    getAudioContext();

    const startedSession = createSession(startedAt, subtaskId);
    const nextRunningSession = {
      taskId,
      subtaskId,
      startTime: startedSession.startTime,
    };

    setRunningSession(nextRunningSession);
    setSessionStartTime(startedAt);
  };

  const pauseRunningSession = () => {
    if (!runningSession) {
      return;
    }

    stopRunningSession(new Date());
    setSessionStartTime(null);
  };

  const visibleTasks = tasks.filter((task) => !task.hidden);
  const hiddenTasks = tasks.filter((task) => task.hidden);
  const activeTask = visibleTasks[activeIndex] ?? null;
  const completedTasks = visibleTasks.filter((task) => task.done).length;

  useEffect(() => {
    saveUiState({
      activeTaskId: activeTask?.id ?? null,
      activeView,
      showSubWheel,
    });
  }, [activeTask?.id, activeView, showSubWheel]);

  useEffect(() => {
    const saveStateBeforePageIsHidden = () => {
      saveUiState({
        activeTaskId: activeTask?.id ?? null,
        activeView,
        showSubWheel,
      });
    };

    window.addEventListener("pagehide", saveStateBeforePageIsHidden);
    document.addEventListener("visibilitychange", saveStateBeforePageIsHidden);

    return () => {
      window.removeEventListener("pagehide", saveStateBeforePageIsHidden);
      document.removeEventListener(
        "visibilitychange",
        saveStateBeforePageIsHidden
      );
    };
  }, [activeTask?.id, activeView, showSubWheel]);

  // Łączny czas zapisanych sesji w bieżącym cyklu.
  const headerDate = formatHeaderDate(currentTime);
  const headerTime = formatHeaderTime(currentTime);
  const getRunningSessionElapsedInCycle = (task, subtaskId = undefined) => {
    if (!runningSession || runningSession.taskId !== task.id) {
      return 0;
    }

    if (subtaskId !== undefined && runningSession.subtaskId !== subtaskId) {
      return 0;
    }

    const runningStartedAt = new Date(runningSession.startTime);
    const taskCycleStartTime = getTaskCycleStartTime(task, cycleStartTime);
    const effectiveStartTime =
      runningStartedAt.getTime() > taskCycleStartTime.getTime()
        ? runningStartedAt
        : taskCycleStartTime;

    return calculateElapsedSeconds(effectiveStartTime, currentTime);
  };

  const getTaskSpentInCycle = (task) =>
    getCycleDuration(task, cycleStartTime) +
    getRunningSessionElapsedInCycle(task);

  const getTaskProgress = (task) => {
    const targetSeconds = getTargetSeconds(task);
    const spentSeconds = getTaskSpentInCycle(task);

    return {
      spentSeconds,
      targetSeconds,
      percent: getTimeProgressPercent(spentSeconds, targetSeconds),
    };
  };

  const taskProgressById = Object.fromEntries(
    visibleTasks.map((task) => [task.id, getTaskProgress(task)])
  );
  const activeTaskProgress = activeTask ? taskProgressById[activeTask.id] : null;
  const activeTaskRemainingSeconds = activeTaskProgress
    ? Math.max(activeTaskProgress.targetSeconds - activeTaskProgress.spentSeconds, 0)
    : 0;
  const subtaskProgressById = activeTask
    ? Object.fromEntries(
        activeTask.subtasks.map((subtask) => {
          const spentSeconds =
            getCycleDuration(activeTask, cycleStartTime, subtask.id) +
            getRunningSessionElapsedInCycle(activeTask, subtask.id);
          const targetSeconds = getTargetSeconds(subtask);

          return [
            subtask.id,
            {
              spentSeconds,
              targetSeconds,
              percent: getTimeProgressPercent(spentSeconds, targetSeconds),
            },
          ];
        })
      )
    : {};

  useEffect(() => {
    if (
      !runningSession ||
      !activeTask ||
      runningSession.taskId !== activeTask.id ||
      !activeTaskProgress ||
      activeTaskProgress.targetSeconds <= 0
    ) {
      previousRemainingSecondsRef.current = null;
      soundSessionKeyRef.current = null;
      playedSoundKeysRef.current.clear();
      return;
    }

    const sessionKey = `${runningSession.taskId}:${runningSession.startTime}`;
    if (soundSessionKeyRef.current !== sessionKey) {
      soundSessionKeyRef.current = sessionKey;
      previousRemainingSecondsRef.current = activeTaskRemainingSeconds;
      playedSoundKeysRef.current.clear();
      return;
    }

    const previousRemainingSeconds = previousRemainingSecondsRef.current;
    if (previousRemainingSeconds === null) {
      previousRemainingSecondsRef.current = activeTaskRemainingSeconds;
      return;
    }

    TASK_SOUND_ALERTS.forEach(({ thresholdSeconds, beepCount }) => {
      const soundKey = `${sessionKey}:${thresholdSeconds}`;
      if (
        previousRemainingSeconds > thresholdSeconds &&
        activeTaskRemainingSeconds <= thresholdSeconds &&
        !playedSoundKeysRef.current.has(soundKey)
      ) {
        playedSoundKeysRef.current.add(soundKey);
        playBeeps(beepCount);
      }
    });

    const completionSoundKey = `${sessionKey}:complete`;
    if (
      previousRemainingSeconds > 0 &&
      activeTaskRemainingSeconds <= 0 &&
      !playedSoundKeysRef.current.has(completionSoundKey)
    ) {
      playedSoundKeysRef.current.add(completionSoundKey);
      playCompletionSound();
    }

    previousRemainingSecondsRef.current = activeTaskRemainingSeconds;
  }, [
    activeTask,
    activeTaskProgress,
    activeTaskRemainingSeconds,
    playBeeps,
    playCompletionSound,
    runningSession,
  ]);

  const totalTargetSeconds = visibleTasks.reduce(
    (sum, task) => sum + getTargetSeconds(task),
    0
  );
  const totalProgressSeconds = visibleTasks.reduce((sum, task) => {
    const taskProgress = taskProgressById[task.id];
    return sum + Math.min(taskProgress.spentSeconds, taskProgress.targetSeconds);
  }, 0);
  const totalSpentSeconds = visibleTasks.reduce((sum, task) => {
    const taskProgress = taskProgressById[task.id];
    return sum + taskProgress.spentSeconds;
  }, 0);
  const remainingSeconds = visibleTasks.reduce((sum, task) => {
    const taskProgress = taskProgressById[task.id];
    return sum + Math.max(taskProgress.targetSeconds - taskProgress.spentSeconds, 0);
  }, 0);
  const overTargetSeconds = visibleTasks.reduce((sum, task) => {
    const taskProgress = taskProgressById[task.id];
    return sum + Math.max(taskProgress.spentSeconds - taskProgress.targetSeconds, 0);
  }, 0);
  const taskStats = visibleTasks
    .map((task) => ({
      id: task.id,
      title: task.title,
      icon: task.icon,
      ...taskProgressById[task.id],
    }))
    .sort((a, b) => b.spentSeconds - a.spentSeconds);
  const cycleSessionCount =
    getCycleSessions(visibleTasks, cycleStartTime).length +
    (runningSession ? 1 : 0);
  const stats = {
    spentSeconds: totalSpentSeconds,
    targetSeconds: totalTargetSeconds,
    remainingSeconds,
    overTargetSeconds,
    sessionCount: cycleSessionCount,
    progressPercent:
      totalTargetSeconds > 0
        ? getTimeProgressPercent(totalProgressSeconds, totalTargetSeconds)
        : 0,
  };
  const dailyTotalSaved = visibleTasks.reduce(
    (sum, task) => sum + getCycleDuration(task, cycleStartTime),
    0
  );
  const dailyTotalSavedForTask = activeTask
    ? getCycleDuration(activeTask, cycleStartTime)
    : 0;

  const selectTask = (nextIndex) => {
    if (
      nextIndex < 0 ||
      nextIndex >= visibleTasks.length
    ) {
      return;
    }

    const now = new Date();
    const nextTask = visibleTasks[nextIndex];
    const reopenTaskIfDone = (taskId) => {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId && task.done ? { ...task, done: false } : task
        )
      );
    };

    if (nextIndex === activeIndex) {
      if (
        nextTask &&
        runningSession?.taskId !== nextTask.id
      ) {
        if (runningSession) {
          stopRunningSession(now);
        }

        reopenTaskIfDone(nextTask.id);
        startRunningSessionForTask(nextTask.id, now);
      }

      return;
    }

    playTaskSwitchSound();

    if (runningSession) {
      stopRunningSession(now);
    }

    setActiveIndex(nextIndex);

    if (nextTask) {
      reopenTaskIfDone(nextTask.id);
      startRunningSessionForTask(nextTask.id, now);
    }
  };

  function activateSubtask(subtaskId) {
    if (!activeTask) {
      return;
    }

    const nextSubtaskId =
      runningSession?.taskId === activeTask.id &&
      runningSession?.subtaskId === subtaskId
        ? null
        : subtaskId;
    const now = new Date();

    if (runningSession) {
      stopRunningSession(now);
    }

    if (!activeTask.done) {
      startRunningSessionForTask(activeTask.id, now, nextSubtaskId);
    }
  }

  function hideTask(taskId) {
    const taskToHide = tasks.find((task) => task.id === taskId);
    if (!taskToHide) {
      return;
    }

    const now = new Date();
    if (runningSession?.taskId === taskId) {
      stopRunningSession(now);
      setSessionStartTime(null);
    }

    const visibleAfterHide = visibleTasks.filter((task) => task.id !== taskId);

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, hidden: true } : task
      )
    );
    setShowSubWheel(false);
    const nextActiveIndex =
      visibleAfterHide.length > 0
        ? Math.min(activeIndex, visibleAfterHide.length - 1)
        : 0;
    setActiveIndex(nextActiveIndex);

    const nextTask = visibleAfterHide[nextActiveIndex];
    if (runningSession?.taskId === taskId && nextTask && !nextTask.done) {
      startRunningSessionForTask(nextTask.id, now);
    }
  }

  function restoreTask(taskId) {
    const hadVisibleTasks = visibleTasks.length > 0;
    const taskToRestore = tasks.find((task) => task.id === taskId);

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, hidden: false } : task
      )
    );

    if (!hadVisibleTasks && taskToRestore && !taskToRestore.done) {
      setActiveIndex(0);
      startRunningSessionForTask(taskToRestore.id, new Date());
    }
  }

  function finishTask() {
    if (!activeTask) {
      return;
    }

    const now = new Date();
    if (runningSession && runningSession.taskId === activeTask.id) {
      stopRunningSession(now);
    }

    setSessionStartTime(null);

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === activeTask.id ? { ...task, done: true } : task
      )
    );

    setShowSubWheel(false);

    setActiveIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      const normalizedIndex = nextIndex >= visibleTasks.length ? 0 : nextIndex;
      return normalizedIndex;
    });
  }

  function resetTaskToday(taskId) {
    const taskToReset = tasks.find((task) => task.id === taskId);
    if (!taskToReset) {
      return;
    }

    const confirmed = window.confirm(
      `Zresetowac progres taska "${taskToReset.title}" w biezacym cyklu?`
    );
    if (!confirmed) {
      return;
    }

    const resetAt = new Date();

    if (runningSession?.taskId === taskId) {
      setRunningSession(null);
      clearRunningSession();
      setSessionStartTime(null);
    }

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? resetTaskForCycle(task, resetAt) : task
      )
    );
  }

  function resetAllTasksToday() {
    const confirmed = window.confirm(
      "Zresetowac progres calego cyklu?"
    );
    if (!confirmed) {
      return;
    }

    const resetAt = new Date();

    if (runningSession) {
      setRunningSession(null);
      clearRunningSession();
      setSessionStartTime(null);
    }

    setCycleStartTime(resetAt);
    setTasks((prevTasks) =>
      prevTasks.map((task) => resetTaskCycleMarker(task))
    );
  }

  function toggleSubtask(subtaskId) {
    if (!activeTask) {
      return;
    }

    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id !== activeTask.id) return task;

        return {
          ...task,
          subtasks: task.subtasks.map((subtask) =>
            subtask.id === subtaskId
              ? { ...subtask, done: !subtask.done }
              : subtask
          ),
        };
      })
    );
  }

  function updateTask(taskId, updates) {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...updates,
              targetMinutes: Math.max(0, Number(updates.targetMinutes) || 0),
            }
          : task
      )
    );
  }

  function updateSubtask(taskId, subtaskId, updates) {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id !== taskId) return task;

        return {
          ...task,
          subtasks: task.subtasks.map((subtask) =>
            subtask.id === subtaskId
              ? {
                  ...subtask,
                  ...updates,
                  targetMinutes: Math.max(
                    0,
                    Number(updates.targetMinutes) || 0
                  ),
                }
              : subtask
          ),
        };
      })
    );
  }

  function updateNewTaskFormField(field, value) {
    setNewTaskForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  const renderNewTaskIconPicker = () => (
    <div className="icon-picker" aria-label="Szybki wybor ikony">
      {ICON_OPTIONS.map((icon) => (
        <button
          key={icon}
          type="button"
          className={newTaskForm.icon === icon ? "selected" : ""}
          onClick={() => updateNewTaskFormField("icon", icon)}
          aria-label={`Uzyj ikony ${icon}`}
        >
          {icon}
        </button>
      ))}
    </div>
  );

  function addTask(event) {
    event.preventDefault();

    const nextId =
      tasks.reduce((maxId, task) => Math.max(maxId, Number(task.id) || 0), 0) + 1;
    const nextTask = createTaskFromForm(newTaskForm, nextId);
    const hadVisibleTasks = visibleTasks.length > 0;

    setTasks((prevTasks) => [...prevTasks, nextTask]);
    setNewTaskForm(emptyTaskForm);
    setIsAddingTask(false);

    if (!hadVisibleTasks) {
      setActiveIndex(0);
      startRunningSessionForTask(nextTask.id, new Date());
    }
  }

  function deleteTask(taskId) {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (!taskToDelete) {
      return;
    }

    const confirmed = window.confirm(
      `Usunac task "${taskToDelete.title}" razem z jego historia?`
    );
    if (!confirmed) {
      return;
    }

    const now = new Date();
    const wasRunning = runningSession?.taskId === taskId;
    const wasActive = activeTask?.id === taskId;
    const visibleAfterDelete = visibleTasks.filter((task) => task.id !== taskId);

    if (wasRunning) {
      stopRunningSession(now);
      setSessionStartTime(null);
    }

    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    setShowSubWheel(false);

    if (!wasActive) {
      return;
    }

    const nextActiveIndex =
      visibleAfterDelete.length > 0
        ? Math.min(activeIndex, visibleAfterDelete.length - 1)
        : 0;
    setActiveIndex(nextActiveIndex);

    const nextTask = visibleAfterDelete[nextActiveIndex];
    if (wasRunning && nextTask && !nextTask.done) {
      startRunningSessionForTask(nextTask.id, now);
    }
  }

  function addSubtask(taskId, subtaskInput) {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id !== taskId) return task;

        const nextSubtaskId =
          task.subtasks.reduce(
            (maxId, subtask) => Math.max(maxId, Number(subtask.id) || 0),
            0
          ) + 1;

        return {
          ...task,
          subtasks: [
            ...task.subtasks,
            {
              id: nextSubtaskId,
              title: subtaskInput.title.trim() || "Nowe podzadanie",
              targetMinutes: Math.max(
                0,
                Number(subtaskInput.targetMinutes) || 0
              ),
              done: false,
            },
          ],
        };
      })
    );
  }

  function deleteSubtask(taskId, subtaskId) {
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    const subtask = task?.subtasks.find(
      (currentSubtask) => currentSubtask.id === subtaskId
    );
    if (!task || !subtask) {
      return;
    }

    const confirmed = window.confirm(
      `Usunac podzadanie "${subtask.title}" razem z jego historia?`
    );
    if (!confirmed) {
      return;
    }

    const now = new Date();
    if (runningSession?.taskId === taskId && runningSession?.subtaskId === subtaskId) {
      stopRunningSession(now);
      startRunningSessionForTask(taskId, now);
    }

    setTasks((prevTasks) =>
      prevTasks.map((currentTask) =>
        currentTask.id === taskId
          ? {
              ...currentTask,
              subtasks: currentTask.subtasks.filter(
                (currentSubtask) => currentSubtask.id !== subtaskId
              ),
              sessions: (currentTask.sessions || []).filter(
                (session) => session.subtaskId !== subtaskId
              ),
            }
          : currentTask
      )
    );
  }

  return (
    <div className="app">
      <main className="main">
        <header className="topbar">
          <div className="topbar-primary">
            <div className="logo">
              <span className="logo-mark"></span>
              <strong>rotate.ma</strong>
            </div>

            <div className="cycle-title">
              {/* <span>Mój cykl:</span> */}
              <strong> Codzienna sukcesywność</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <span>📅 {headerDate} · {headerTime}</span>
            <span>📅 Środa, 22 maja</span>
            <button>🔔</button>
            <button>⋮</button>
          </div>
        </header>

        <nav className="top-menu" aria-label="Główne">
          <button
            type="button"
            className={activeView === "today" ? "active" : ""}
            aria-current={activeView === "today" ? "page" : undefined}
            onClick={() => setActiveView("today")}
          >
            <span className="nav-icon" aria-hidden="true">🏠</span>
            <span className="nav-label">Dzisiaj</span>
          </button>
          <button type="button">
            <span className="nav-icon" aria-hidden="true">🔁</span>
            <span className="nav-label">Moje cykle</span>
          </button>
          <button type="button">
            <span className="nav-icon" aria-hidden="true">📅</span>
            <span className="nav-label">Kalendarz</span>
          </button>
          <button
            type="button"
            className={activeView === "stats" ? "active" : ""}
            aria-current={activeView === "stats" ? "page" : undefined}
            onClick={() => setActiveView("stats")}
          >
            <span className="nav-icon" aria-hidden="true">📊</span>
            <span className="nav-label">Statystyki</span>
          </button>
          <button type="button">
            <span className="nav-icon" aria-hidden="true">🕘</span>
            <span className="nav-label">Historia</span>
          </button>
          <button
            type="button"
            className="theme-toggle-nav"
            aria-pressed={theme === "dark"}
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "dark" ? "light" : "dark"
              )
            }
          >
            <span className="nav-icon" aria-hidden="true">
              {theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}"}
            </span>
            <span className="nav-label">
              {theme === "dark" ? "Jasny" : "Ciemny"}
            </span>
          </button>
          <button type="button">
            <span className="nav-icon" aria-hidden="true">⚙️</span>
            <span className="nav-label">Ustawienia</span>
          </button>
        </nav>

        {activeView === "today" && (
          <section className="content">
            <div className="wheel-area">
              {activeTask && activeTaskProgress && (
                <section className="active-task-summary" aria-live="polite">
                  <div className="active-task-summary-main">
                    <span className="active-task-summary-icon" aria-hidden="true">
                      {activeTask.icon}
                    </span>
                    <div>
                      <span className="active-task-summary-eyebrow">
                        Teraz pracujesz nad
                      </span>
                      <strong>{activeTask.title}</strong>
                    </div>
                  </div>

                  <div className="active-task-summary-progress">
                    <div className="active-task-summary-meta">
                      <span>{activeTaskProgress.percent}% celu</span>
                      <strong>
                        {formatDuration(activeTaskProgress.spentSeconds)} /{" "}
                        {formatDuration(activeTaskProgress.targetSeconds)}
                      </strong>
                    </div>
                    <span className="active-task-summary-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${activeTaskProgress.percent}%`,
                        }}
                      ></span>
                    </span>
                  </div>
                </section>
              )}

              <TaskWheel
                tasks={visibleTasks}
                activeIndex={activeIndex}
                setActiveIndex={selectTask}
                taskProgressById={taskProgressById}
                isActiveTaskRunning={
                  activeTask ? runningSession?.taskId === activeTask.id : false
                }
                pauseRunningSession={pauseRunningSession}
              />

            <div className="progress-card legend-card">
              <div className="legend-header">
                <span>Legenda</span>
                <strong>{visibleTasks.length} tasków</strong>
              </div>

              <button
                type="button"
                className="reset-all-button"
                onClick={resetAllTasksToday}
                disabled={visibleTasks.length === 0}
              >
                Resetuj cały cykl
              </button>

              <div className="task-legend-list">
                {visibleTasks.map((task, index) => {
                  const taskProgress = taskProgressById[task.id] ?? {
                    percent: 0,
                    spentSeconds: 0,
                    targetSeconds: 0,
                  };

                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={`task-legend-row ${
                        index === activeIndex ? "active" : ""
                      }`}
                      onClick={() => selectTask(index)}
                      style={{
                        "--legend-color": getTaskColor(task, index),
                      }}
                    >
                      <span className="legend-dot" aria-hidden="true"></span>
                      <span className="legend-icon" aria-hidden="true">
                        {task.icon}
                      </span>
                      <span className="legend-copy">
                        <strong>{task.title}</strong>
                        <small>
                          {formatDuration(taskProgress.spentSeconds)} /{" "}
                          {formatDuration(taskProgress.targetSeconds)}
                        </small>
                      </span>
                      <span className="legend-percent">
                        {taskProgress.percent}%
                      </span>
                    </button>
                  );
                })}
              </div>

              {isAddingTask ? (
                <form className="edit-form add-task-form" onSubmit={addTask}>
                  <label>
                    <span>Nazwa taska</span>
                    <input
                      value={newTaskForm.title}
                      onChange={(event) =>
                        updateNewTaskFormField("title", event.target.value)
                      }
                    />
                  </label>

                  <div className="compact-form-row">
                    <label>
                      <span>Ikona</span>
                      <input
                        className="icon-input"
                        value={newTaskForm.icon}
                        onChange={(event) =>
                          updateNewTaskFormField("icon", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Minuty</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={newTaskForm.targetMinutes}
                        onChange={(event) =>
                          updateNewTaskFormField(
                            "targetMinutes",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  {renderNewTaskIconPicker()}

                  <label>
                    <span>Opis</span>
                    <textarea
                      rows="2"
                      value={newTaskForm.description}
                      onChange={(event) =>
                        updateNewTaskFormField("description", event.target.value)
                      }
                    />
                  </label>

                  <div className="edit-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTask(false);
                        setNewTaskForm(emptyTaskForm);
                      }}
                    >
                      Anuluj
                    </button>
                    <button type="submit">Dodaj</button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="add-task-button"
                  onClick={() => setIsAddingTask(true)}
                >
                  + Dodaj task
                </button>
              )}

              {hiddenTasks.length > 0 && (
                <div className="hidden-task-list">
                  <span>Ukryte</span>
                  {hiddenTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => restoreTask(task.id)}
                    >
                      {task.icon} {task.title}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>

            {activeTask ? (
              <TaskPanel
                key={activeTask.id}
                task={activeTask}
                finishTask={finishTask}
                resetTaskToday={resetTaskToday}
                hideTask={hideTask}
                deleteTask={deleteTask}
                addSubtask={addSubtask}
                deleteSubtask={deleteSubtask}
                updateTask={updateTask}
                updateSubtask={updateSubtask}
                toggleSubtask={toggleSubtask}
                activateSubtask={activateSubtask}
                showSubWheel={showSubWheel}
                setShowSubWheel={setShowSubWheel}
                sessionStartTime={sessionStartTime}
                elapsedTime={
                  getRunningSessionElapsedInCycle(activeTask)
                }
                dailyTotalSaved={dailyTotalSaved}
                dailyTotalSavedForTask={dailyTotalSavedForTask}
                taskProgress={taskProgressById[activeTask.id]}
                activeSubtaskId={
                  runningSession?.taskId === activeTask.id
                    ? runningSession.subtaskId
                    : null
                }
                subtaskProgressById={subtaskProgressById}
              />
            ) : (
              <aside className="task-panel">
                <h2>Brak zadań</h2>
                <p className="empty">Dodaj zadania, aby rozpocząć cykl.</p>
                <form className="edit-form task-edit-form" onSubmit={addTask}>
                  <label>
                    <span>Nazwa taska</span>
                    <input
                      value={newTaskForm.title}
                      onChange={(event) =>
                        updateNewTaskFormField("title", event.target.value)
                      }
                    />
                  </label>
                  <div className="compact-form-row">
                    <label>
                      <span>Ikona</span>
                      <input
                        className="icon-input"
                        value={newTaskForm.icon}
                        onChange={(event) =>
                          updateNewTaskFormField("icon", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Minuty</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={newTaskForm.targetMinutes}
                        onChange={(event) =>
                          updateNewTaskFormField(
                            "targetMinutes",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                  {renderNewTaskIconPicker()}
                  <div className="edit-actions">
                    <button
                      type="button"
                      onClick={() => setNewTaskForm(emptyTaskForm)}
                    >
                      Wyczyść
                    </button>
                    <button type="submit">Dodaj task</button>
                  </div>
                </form>
              </aside>
            )}
          </section>
        )}

        {activeView === "today" && showSubWheel && activeTask && activeTask.subtasks.length > 0 && (
          <section className="subtask-section">
            <h2>Podzadania jako koło</h2>
            <SubtaskWheel subtasks={activeTask.subtasks} />
          </section>
        )}
        {activeView === "stats" && (
          <StatsPanel
            stats={stats}
            taskStats={taskStats}
            completedTasks={completedTasks}
            visibleTaskCount={visibleTasks.length}
            hiddenTaskCount={hiddenTasks.length}
          />
        )}

        <footer className="app-footer">
          <div className="app-footer-copy">
            <strong>Rotate PWA</strong>
            <span>Zarządzanie instalacją i cache aplikacji.</span>
          </div>
          <div className="app-footer-actions">
            {!isInstalled && (
              <button
                className="install-button"
                type="button"
                onClick={installApp}
              >
                Instaluj
              </button>
            )}
            <button
              className="pwa-refresh-button"
              type="button"
              onClick={refreshPwaCache}
            >
              Odśwież PWA
            </button>
          </div>
          {installNotice && (
            <div className="install-notice" role="status">
              {installNotice}
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}

export default App;
