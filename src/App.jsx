import { useEffect, useState, useRef } from "react";
import TaskPanel from "./components/TaskPanel";
import TaskWheel from "./components/TaskWheel";
import SubtaskWheel from "./components/SubtaskWheel";
import { initialTasks } from "./data/initialTasks";
import { loadTasks, saveTasks } from "./utils/taskStorage";
import {
  createSession,
  endSession,
  addSessionToTask,
  getDailyDuration,
} from "./utils/sessionTracker";
import "./App.css";

const getLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function App() {
  const [tasks, setTasks] = useState(() => loadTasks(initialTasks));
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSubWheel, setShowSubWheel] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(new Date());
  const previousIndexRef = useRef(0);
  const sessionStartTimeRef = useRef(new Date());

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // Zapisz sesję gdy zmienia się zadanie
  useEffect(() => {
    if (tasks.length === 0 || activeIndex >= tasks.length) {
      return;
    }

    // Jeśli zmienił się task - zapisz sesję poprzedniego
    if (previousIndexRef.current !== activeIndex && previousIndexRef.current < tasks.length) {
      const previousIndex = previousIndexRef.current;
      const previousSessionStart = sessionStartTimeRef.current;

      setTasks((prevTasks) => {
        const startedSession = createSession(previousSessionStart);
        const completedSession = endSession(startedSession, new Date());

        return prevTasks.map((task, index) => {
          if (index === previousIndex) {
            return addSessionToTask(task, completedSession);
          }
          return task;
        });
      });
    }

    // Zapamiętaj obecny index i resetuj timer
    previousIndexRef.current = activeIndex;
    sessionStartTimeRef.current = new Date();
    setSessionStartTime(new Date());
  }, [activeIndex, tasks.length]);

  const activeTask = tasks[activeIndex] ?? null;
  const completedTasks = tasks.filter((task) => task.done).length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Łączny czas zapisanych sesji z całego dnia (wszystkie taski)
  const today = getLocalDateKey(new Date());
  const dailyTotalSaved = tasks.reduce(
    (sum, task) => sum + getDailyDuration(task, today),
    0
  );
  const dailyTotalSavedForTask = activeTask
    ? getDailyDuration(activeTask, today)
    : 0;

  function finishTask() {
    if (!activeTask) {
      return;
    }

    setTasks((prevTasks) =>
      prevTasks.map((task, index) =>
        index === activeIndex ? { ...task, done: true } : task
      )
    );

    setShowSubWheel(false);

    setActiveIndex((prevIndex) => {
      const nextIndex = prevIndex + 1;
      return nextIndex >= tasks.length ? 0 : nextIndex;
    });
  }

  function toggleSubtask(subtaskId) {
    if (!activeTask) {
      return;
    }

    setTasks((prevTasks) =>
      prevTasks.map((task, index) => {
        if (index !== activeIndex) return task;

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
            <span>📅 Środa, 22 maja</span>
            <button>🔔</button>
            <button>⋮</button>
          </div>
        </header>

        <section className="content">
          <div className="wheel-area">
            <TaskWheel
              tasks={tasks}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
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
            </div>
          </div>

          {activeTask ? (
            <TaskPanel
              task={activeTask}
              finishTask={finishTask}
              toggleSubtask={toggleSubtask}
              showSubWheel={showSubWheel}
              setShowSubWheel={setShowSubWheel}
              sessionStartTime={sessionStartTime}
              dailyTotalSaved={dailyTotalSaved}
              dailyTotalSavedForTask={dailyTotalSavedForTask}
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
      </main>
    </div>
  );
}

export default App;
