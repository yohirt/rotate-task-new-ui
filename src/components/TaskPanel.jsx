import { formatDuration } from "../utils/sessionTracker";

function TaskPanel({
  task,
  finishTask,
  toggleSubtask,
  activateSubtask,
  showSubWheel,
  setShowSubWheel,
  sessionStartTime,
  elapsedTime = 0,
  dailyTotalSaved,
  dailyTotalSavedForTask,
  taskProgress,
  activeSubtaskId,
  subtaskProgressById = {},
}) {
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const elapsedTimeForDisplay = sessionStartTime ? elapsedTime : 0;
  const targetSeconds = taskProgress?.targetSeconds ?? 0;
  const spentSeconds = taskProgress?.spentSeconds ?? 0;
  const progressPercent = taskProgress?.percent ?? 0;

  return (
    <aside className="task-panel">
      <div className="panel-icon">{task.icon}</div>

      <h2>{task.title}</h2>

      <div className="task-goal">
        <div>
          <span>Cel czasowy</span>
          <strong>
            {formatDuration(spentSeconds)} / {formatDuration(targetSeconds)}
          </strong>
        </div>
        <strong>{progressPercent}%</strong>
      </div>
      <div className="task-goal-bar">
        <div style={{ width: `${progressPercent}%` }}></div>
      </div>

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
          {task.subtasks.map((subtask) => {
            const progress = subtaskProgressById[subtask.id] ?? {
              spentSeconds: 0,
              targetSeconds: 0,
              percent: 0,
            };

            return (
              <li
                key={subtask.id}
                className={activeSubtaskId === subtask.id ? "active-subtask" : ""}
              >
                <button
                  type="button"
                  className={subtask.done ? "checked" : ""}
                  onClick={() => toggleSubtask(subtask.id)}
                  aria-label={
                    subtask.done
                      ? `Oznacz "${subtask.title}" jako niewykonane`
                      : `Oznacz "${subtask.title}" jako wykonane`
                  }
                >
                  {subtask.done ? "✓" : ""}
                </button>

                <button
                  type="button"
                  className="subtask-progress-button"
                  onClick={() => activateSubtask(subtask.id)}
                >
                  <span className="subtask-title-row">
                    <span className={subtask.done ? "done-text" : ""}>
                      {subtask.title}
                    </span>
                    <strong>{progress.percent}%</strong>
                  </span>
                  <span className="subtask-time-row">
                    {formatDuration(progress.spentSeconds)} /{" "}
                    {formatDuration(progress.targetSeconds)}
                  </span>
                  <span className="subtask-progress-bar">
                    <span style={{ width: `${progress.percent}%` }}></span>
                  </span>
                </button>
              </li>
            );
          })}
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
