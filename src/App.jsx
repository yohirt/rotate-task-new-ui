import { useEffect, useState } from "react";
import TaskPanel from "./components/TaskPanel";
import StatsPanel from "./components/StatsPanel";
import TaskWheel from "./components/TaskWheel";
import SubtaskWheel from "./components/SubtaskWheel";
import { initialTasks } from "./data/initialTasks";
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
  getDailyDuration,
  getDailySessions,
  getDailySubtaskDuration,
  getTargetSeconds,
  getTimeProgressPercent,
} from "./utils/sessionTracker";
import "./App.css";

const getLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatHeaderDate = (date) =>
  date.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

function App() {
  const [installPrompt, setInstallPrompt] = useState(null);
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
    };
  });

  const [tasks, setTasks] = useState(bootstrap.initialTasksState);
  const [activeIndex, setActiveIndex] = useState(bootstrap.initialActiveIndex);
  const [showSubWheel, setShowSubWheel] = useState(false);
  const [runningSession, setRunningSession] = useState(
    bootstrap.initialRunningSession
  );
  const [sessionStartTime, setSessionStartTime] = useState(
    bootstrap.initialSessionStartTime
  );
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

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
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setInstallNotice("");
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setInstallNotice("Aplikacja została zainstalowana.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
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
    const startedSession = createSession(startedAt, subtaskId);
    const nextRunningSession = {
      taskId,
      subtaskId,
      startTime: startedSession.startTime,
    };

    setRunningSession(nextRunningSession);
    setSessionStartTime(startedAt);
  };

  const visibleTasks = tasks.filter((task) => !task.hidden);
  const hiddenTasks = tasks.filter((task) => task.hidden);
  const activeTask = visibleTasks[activeIndex] ?? null;
  const completedTasks = visibleTasks.filter((task) => task.done).length;

  // Łączny czas zapisanych sesji z całego dnia (wszystkie taski)
  const today = getLocalDateKey(new Date());
  const headerDate = formatHeaderDate(currentTime);
  const runningSessionElapsed = runningSession
    ? calculateElapsedSeconds(runningSession.startTime, currentTime)
    : 0;

  const getTaskSpentToday = (task) =>
    getDailyDuration(task, today) +
    (runningSession?.taskId === task.id ? runningSessionElapsed : 0);

  const getTaskProgress = (task) => {
    const targetSeconds = getTargetSeconds(task);
    const spentSeconds = getTaskSpentToday(task);

    return {
      spentSeconds,
      targetSeconds,
      percent: getTimeProgressPercent(spentSeconds, targetSeconds),
    };
  };

  const taskProgressById = Object.fromEntries(
    visibleTasks.map((task) => [task.id, getTaskProgress(task)])
  );
  const subtaskProgressById = activeTask
    ? Object.fromEntries(
        activeTask.subtasks.map((subtask) => {
          const spentSeconds =
            getDailySubtaskDuration(activeTask, subtask.id, today) +
            (runningSession?.taskId === activeTask.id &&
            runningSession?.subtaskId === subtask.id
              ? runningSessionElapsed
              : 0);
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
  const todaySessionCount =
    getDailySessions(visibleTasks, today).length + (runningSession ? 1 : 0);
  const stats = {
    spentSeconds: totalSpentSeconds,
    targetSeconds: totalTargetSeconds,
    remainingSeconds,
    overTargetSeconds,
    sessionCount: todaySessionCount,
    progressPercent:
      totalTargetSeconds > 0
        ? getTimeProgressPercent(totalProgressSeconds, totalTargetSeconds)
        : 0,
  };
  const progress =
    totalTargetSeconds > 0
      ? getTimeProgressPercent(totalProgressSeconds, totalTargetSeconds)
      : visibleTasks.length > 0
        ? Math.round((completedTasks / visibleTasks.length) * 100)
        : 0;

  const dailyTotalSaved = visibleTasks.reduce(
    (sum, task) => sum + getDailyDuration(task, today),
    0
  );
  const dailyTotalSavedForTask = activeTask
    ? getDailyDuration(activeTask, today)
    : 0;

  const selectTask = (nextIndex) => {
    if (
      nextIndex === activeIndex ||
      nextIndex < 0 ||
      nextIndex >= visibleTasks.length
    ) {
      return;
    }

    const now = new Date();
    if (runningSession) {
      stopRunningSession(now);
    }

    setActiveIndex(nextIndex);

    const nextTask = visibleTasks[nextIndex];
    if (nextTask && !nextTask.done) {
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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark"></span>
          <strong>rotate.ma</strong>
        </div>

        <nav className="menu">
          <button className="active">🏠 Dzisiaj</button>
          <button>🔁 Moje cykle</button>
          <button>📅 Kalendarz</button>
          <button>📊 Statystyki</button>
          <button>🕘 Historia</button>
          <button>⚙️ Ustawienia</button>
        </nav>

        <div className="user-box">
          <div className="avatar">R</div>
          <div>
            <strong>Rafał</strong>
            <small>aktywny cykl</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span>Mój cykl:</span>
            <strong> Codzienna rutyna</strong>
          </div>

          <div className="topbar-actions">
            <span>📅 {headerDate}</span>
            <span>📅 Środa, 22 maja</span>
            {!isInstalled && (
              <button
                className="install-button"
                type="button"
                onClick={installApp}
              >
                Instaluj
              </button>
            )}
            <button>🔔</button>
            <button>⋮</button>
          </div>
        </header>
        {installNotice && (
          <div className="install-notice" role="status">
            {installNotice}
          </div>
        )}

        <section className="content">
          <div className="wheel-area">
            <TaskWheel
              tasks={visibleTasks}
              activeIndex={activeIndex}
              setActiveIndex={selectTask}
              taskProgressById={taskProgressById}
            />

            <div className="progress-card">
              <div className="progress-title">
                <span>Postęp cyklu</span>
                <strong>{progress}%</strong>
              </div>

              <div className="progress-bar">
                <div style={{ width: `${progress}%` }}></div>
              </div>

              <small>
                {completedTasks} z {tasks.length} zadań wykonane
              </small>

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
              hideTask={hideTask}
              updateTask={updateTask}
              updateSubtask={updateSubtask}
              toggleSubtask={toggleSubtask}
              activateSubtask={activateSubtask}
              showSubWheel={showSubWheel}
              setShowSubWheel={setShowSubWheel}
              sessionStartTime={sessionStartTime}
              elapsedTime={
                runningSession?.taskId === activeTask.id
                  ? runningSessionElapsed
                  : 0
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
            </aside>
          )}
        </section>

        {showSubWheel && activeTask && activeTask.subtasks.length > 0 && (
          <section className="subtask-section">
            <h2>Podzadania jako koło</h2>
            <SubtaskWheel subtasks={activeTask.subtasks} />
          </section>
        )}
        <StatsPanel
          stats={stats}
          taskStats={taskStats}
          completedTasks={completedTasks}
          visibleTaskCount={visibleTasks.length}
          hiddenTaskCount={hiddenTasks.length}
        />
      </main>
    </div>
  );
}

export default App;
