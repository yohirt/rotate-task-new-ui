function TaskWheel({ tasks, activeIndex, setActiveIndex }) {
  if (tasks.length === 0) {
    return null;
  }

  const angleStep = 360 / tasks.length;

  return (
    <div className="task-wheel">
      <div
        className="wheel-rotator"
        style={{
          transform: `rotate(${-activeIndex * angleStep}deg)`,
        }}
      >
        {tasks.map((task, index) => {
          const angle = index * angleStep;

          return (
            <button
              key={task.id}
              className={`wheel-item ${
                index === activeIndex ? "active" : ""
              } ${task.done ? "done" : ""}`}
              style={{
                transform: `rotate(${angle}deg) translate(0, -155px) rotate(${-angle + activeIndex * angleStep}deg)`,
              }}
              onClick={() => setActiveIndex(index)}
            >
              <span className="task-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="task-icon">{task.icon}</span>
              <strong>{task.title}</strong>
            </button>
          );
        })}
      </div>

      <div className="wheel-center">
        <small>AKTUALNE ZADANIE</small>
        <h1>{tasks[activeIndex].title}</h1>
        <p>{tasks[activeIndex].time}</p>
      </div>
    </div>
  );
}

export default TaskWheel;
