import { useEffect, useState } from "react";
import { calculateElapsedSeconds, formatDuration } from "../utils/sessionTracker";

function TaskPanel({
  task,
  finishTask,
  toggleSubtask,
  showSubWheel,
  setShowSubWheel,
  sessionStartTime,
  dailyTotalSaved,
  dailyTotalSavedForTask,
}) {
  const [elapsedTime, setElapsedTime] = useState(() =>
    calculateElapsedSeconds(sessionStartTime)
  );
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.done).length;

  useEffect(() => {
    if (!sessionStartTime) {
      return;
    }

    const updateElapsedTime = () => {
      setElapsedTime(calculateElapsedSeconds(sessionStartTime));
    };

    const initialUpdate = setTimeout(updateElapsedTime, 0);
    const interval = setInterval(updateElapsedTime, 1000);
    window.addEventListener("focus", updateElapsedTime);
    window.addEventListener("pageshow", updateElapsedTime);
    document.addEventListener("visibilitychange", updateElapsedTime);

    return () => {
      clearTimeout(initialUpdate);
      clearInterval(interval);
      window.removeEventListener("focus", updateElapsedTime);
      window.removeEventListener("pageshow", updateElapsedTime);
      document.removeEventListener("visibilitychange", updateElapsedTime);
    };
  }, [sessionStartTime]);

  const elapsedTimeForDisplay = sessionStartTime ? elapsedTime : 0;

  return (
    <aside className="task-panel">
      <div className="panel-icon">{task.icon}</div>

      <h2>{task.title}</h2>

      <div className="timer-display">
        <div className="timer-section">
          <div className="timer-value">{formatDuration(elapsedTimeForDisplay)}</div>
          <div className="timer-label">Czas sesji</div>
        </div>
        <div className="timer-section">
          <div className="timer-value-small">
            {formatDuration(dailyTotalSavedForTask + elapsedTimeForDisplay)}
          </div>
          <div className="timer-label">Ten task dzisiaj</div>
        </div>
        <div className="timer-section">
          <div className="timer-value-small">
            {formatDuration(dailyTotalSaved + elapsedTimeForDisplay)}
          </div>
          <div className="timer-label">Dzisiaj razem</div>
        </div>
      </div>

      <div className="meta">
        <span>🔁 Codziennie</span>
      </div>

      <p className="description">{task.description}</p>

      <hr />

      <div className="subtask-header">
        <strong>Podzadania</strong>
        <span>
          {completedSubtasks} / {task.subtasks.length} wykonane
        </span>
      </div>

      {task.subtasks.length > 0 ? (
        <ul className="subtask-list">
          {task.subtasks.map((subtask) => (
            <li key={subtask.id}>
              <button
                className={subtask.done ? "checked" : ""}
                onClick={() => toggleSubtask(subtask.id)}
              >
                {subtask.done ? "✓" : ""}
              </button>
              <span className={subtask.done ? "done-text" : ""}>
                {subtask.title}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">To zadanie nie ma podzadań.</p>
      )}

      <div className="panel-actions">
        <button
          className="secondary"
          onClick={() => setShowSubWheel(!showSubWheel)}
          disabled={task.subtasks.length === 0}
        >
          Podzadania jako koło
        </button>

        <button className="primary" onClick={finishTask}>
          ✓ Zatrzymaj zadanie
        </button>
      </div>
    </aside>
  );
}

export default TaskPanel;
