import { formatDuration } from "../utils/sessionTracker";

function StatsPanel({
  stats,
  taskStats,
  completedTasks,
  visibleTaskCount,
  hiddenTaskCount,
}) {
  const hasTasks = taskStats.length > 0;

  return (
    <section className="stats-section">
      <div className="stats-header">
        <div>
          <span>Statystyki</span>
          <h2>Bieżący cykl</h2>
        </div>
        <strong>{stats.progressPercent}%</strong>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <span>Wykonane</span>
          <strong>{formatDuration(stats.spentSeconds)}</strong>
        </div>
        <div className="stat-box">
          <span>Plan</span>
          <strong>{formatDuration(stats.targetSeconds)}</strong>
        </div>
        <div className="stat-box">
          <span>Pozostało</span>
          <strong>{formatDuration(stats.remainingSeconds)}</strong>
        </div>
        <div className="stat-box">
          <span>Sesje</span>
          <strong>{stats.sessionCount}</strong>
        </div>
      </div>

      <div className="stats-meta">
        <span>
          {completedTasks} / {visibleTaskCount} tasków zakończone
        </span>
        {hiddenTaskCount > 0 && <span>{hiddenTaskCount} ukryte</span>}
        {stats.overTargetSeconds > 0 && (
          <span>+{formatDuration(stats.overTargetSeconds)} ponad plan</span>
        )}
      </div>

      <div className="stats-task-list">
        {hasTasks ? (
          taskStats.map((task) => (
            <div className="stats-task-row" key={task.id}>
              <div className="stats-task-title">
                <span>
                  {task.icon} {task.title}
                </span>
                <strong>{task.percent}%</strong>
              </div>
              <div className="stats-task-bar">
                <div style={{ width: `${task.percent}%` }}></div>
              </div>
              <small>
                {formatDuration(task.spentSeconds)} /{" "}
                {formatDuration(task.targetSeconds)}
              </small>
            </div>
          ))
        ) : (
          <p className="empty">Brak widocznych tasków do pokazania.</p>
        )}
      </div>
    </section>
  );
}

export default StatsPanel;
