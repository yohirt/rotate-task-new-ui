import { useState } from "react";
import { ICON_OPTIONS } from "../data/taskIcons";
import { formatDuration } from "../utils/sessionTracker";

const getTaskFormState = (task) => ({
  title: task.title,
  icon: task.icon,
  targetMinutes: String(task.targetMinutes ?? 0),
  description: task.description,
});

const getSubtaskFormState = (subtask) => ({
  title: subtask.title,
  targetMinutes: String(subtask.targetMinutes ?? 0),
});

const emptySubtaskForm = {
  title: "",
  targetMinutes: "15",
};

function TaskPanel({
  task,
  finishTask,
  resetTaskToday,
  hideTask,
  deleteTask,
  addSubtask,
  deleteSubtask,
  updateTask,
  updateSubtask,
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
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [taskForm, setTaskForm] = useState(() => getTaskFormState(task));
  const [subtaskForm, setSubtaskForm] = useState(null);
  const [newSubtaskForm, setNewSubtaskForm] = useState(emptySubtaskForm);
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.done).length;
  const elapsedTimeForDisplay = sessionStartTime ? elapsedTime : 0;
  const targetSeconds = taskProgress?.targetSeconds ?? 0;
  const spentSeconds = taskProgress?.spentSeconds ?? 0;
  const progressPercent = taskProgress?.percent ?? 0;

  const updateTaskFormField = (field, value) => {
    setTaskForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const startSubtaskEdit = (subtask) => {
    setEditingSubtaskId(subtask.id);
    setSubtaskForm(getSubtaskFormState(subtask));
  };

  const toggleTaskEdit = () => {
    if (isEditingTask) {
      setIsEditingTask(false);
      return;
    }

    setTaskForm(getTaskFormState(task));
    setIsEditingTask(true);
  };

  const submitTaskEdit = (event) => {
    event.preventDefault();

    updateTask(task.id, {
      title: taskForm.title.trim() || task.title,
      icon: taskForm.icon.trim() || task.icon,
      targetMinutes: taskForm.targetMinutes,
      description: taskForm.description.trim(),
    });
    setIsEditingTask(false);
  };

  const submitSubtaskEdit = (event, subtask) => {
    event.preventDefault();

    updateSubtask(task.id, subtask.id, {
      title: subtaskForm.title.trim() || subtask.title,
      targetMinutes: subtaskForm.targetMinutes,
    });
    setEditingSubtaskId(null);
    setSubtaskForm(null);
  };

  const submitNewSubtask = (event) => {
    event.preventDefault();

    addSubtask(task.id, newSubtaskForm);
    setNewSubtaskForm(emptySubtaskForm);
    setIsAddingSubtask(false);
  };

  return (
    <aside className="task-panel">
      <div className="panel-topline">
        <div className="panel-icon">{task.icon}</div>
        <button
          type="button"
          className="icon-button"
          onClick={toggleTaskEdit}
          aria-label={isEditingTask ? "Zamknij edycje taska" : "Edytuj task"}
          title={isEditingTask ? "Zamknij edycje taska" : "Edytuj task"}
        >
          {isEditingTask ? "\u00D7" : "\u270E"}
        </button>
      </div>

      {isEditingTask ? (
        <form className="edit-form task-edit-form" onSubmit={submitTaskEdit}>
          <label>
            <span>Nazwa taska</span>
            <input
              value={taskForm.title}
              onChange={(event) => updateTaskFormField("title", event.target.value)}
            />
          </label>

          <label>
            <span>Ikona</span>
            <input
              className="icon-input"
              value={taskForm.icon}
              onChange={(event) => updateTaskFormField("icon", event.target.value)}
              aria-label="Ikona taska"
            />
          </label>

          <div className="icon-picker" aria-label="Szybki wybor ikony">
            {ICON_OPTIONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={taskForm.icon === icon ? "selected" : ""}
                onClick={() => updateTaskFormField("icon", icon)}
                aria-label={`Uzyj ikony ${icon}`}
              >
                {icon}
              </button>
            ))}
          </div>

          <label>
            <span>Cel w minutach</span>
            <input
              type="number"
              min="0"
              step="5"
              value={taskForm.targetMinutes}
              onChange={(event) =>
                updateTaskFormField("targetMinutes", event.target.value)
              }
            />
          </label>

          <label>
            <span>Opis</span>
            <textarea
              rows="3"
              value={taskForm.description}
              onChange={(event) =>
                updateTaskFormField("description", event.target.value)
              }
            />
          </label>

          <div className="edit-actions">
            <button type="button" onClick={() => setIsEditingTask(false)}>
              Anuluj
            </button>
            <button type="submit">Zapisz</button>
          </div>
        </form>
      ) : (
        <h2>{task.title}</h2>
      )}

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
          <div className="timer-label">Ten task w cyklu</div>
        </div>
        <div className="timer-section">
          <div className="timer-value-small">
            {formatDuration(dailyTotalSaved + elapsedTimeForDisplay)}
          </div>
          <div className="timer-label">Cykl razem</div>
        </div>
      </div>

      <div className="meta">
        <span>{"\u{1F501}"} Codziennie</span>
      </div>

      <p className="description">{task.description}</p>

      <hr />

      <div className="subtask-header">
        <strong>Podzadania</strong>
        <span>
          {completedSubtasks} / {task.subtasks.length} wykonane
        </span>
      </div>

      {isAddingSubtask ? (
        <form className="edit-form add-subtask-form" onSubmit={submitNewSubtask}>
          <label>
            <span>Nazwa podzadania</span>
            <input
              value={newSubtaskForm.title}
              onChange={(event) =>
                setNewSubtaskForm((currentForm) => ({
                  ...currentForm,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Cel w minutach</span>
            <input
              type="number"
              min="0"
              step="5"
              value={newSubtaskForm.targetMinutes}
              onChange={(event) =>
                setNewSubtaskForm((currentForm) => ({
                  ...currentForm,
                  targetMinutes: event.target.value,
                }))
              }
            />
          </label>
          <div className="edit-actions">
            <button
              type="button"
              onClick={() => {
                setIsAddingSubtask(false);
                setNewSubtaskForm(emptySubtaskForm);
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
          className="add-subtask-button"
          onClick={() => setIsAddingSubtask(true)}
        >
          + Dodaj podzadanie
        </button>
      )}

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
                {editingSubtaskId === subtask.id ? (
                  <form
                    className="edit-form subtask-edit-form"
                    onSubmit={(event) => submitSubtaskEdit(event, subtask)}
                  >
                    <label>
                      <span>Nazwa podzadania</span>
                      <input
                        value={subtaskForm.title}
                        onChange={(event) =>
                          setSubtaskForm((currentForm) => ({
                            ...currentForm,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Cel w minutach</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={subtaskForm.targetMinutes}
                        onChange={(event) =>
                          setSubtaskForm((currentForm) => ({
                            ...currentForm,
                            targetMinutes: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="edit-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubtaskId(null);
                          setSubtaskForm(null);
                        }}
                      >
                        Anuluj
                      </button>
                      <button type="submit">Zapisz</button>
                    </div>
                  </form>
                ) : (
                  <>
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
                      {subtask.done ? "\u2713" : ""}
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

                    <button
                      type="button"
                      className="icon-button subtask-edit-button"
                      onClick={() => startSubtaskEdit(subtask)}
                      aria-label={`Edytuj podzadanie ${subtask.title}`}
                      title="Edytuj podzadanie"
                    >
                      {"\u270E"}
                    </button>

                    <button
                      type="button"
                      className="icon-button subtask-delete-button"
                      onClick={() => deleteSubtask(task.id, subtask.id)}
                      aria-label={`Usun podzadanie ${subtask.title}`}
                      title="Usun podzadanie"
                    >
                      {"\u00D7"}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">To zadanie nie ma podzadań.</p>
      )}

      <div className="panel-actions">
        <button className="secondary" onClick={() => hideTask(task.id)}>
          Ukryj task
        </button>

        <button
          className="secondary"
          onClick={() => setShowSubWheel(!showSubWheel)}
          disabled={task.subtasks.length === 0}
        >
          Podzadania jako koło
        </button>

        <button className="primary" onClick={finishTask}>
          {"\u2713"} Zatrzymaj zadanie
        </button>

        <button className="secondary" onClick={() => resetTaskToday(task.id)}>
          Resetuj w cyklu
        </button>

        <button className="danger" onClick={() => deleteTask(task.id)}>
          Usuń task
        </button>
      </div>
    </aside>
  );
}

export default TaskPanel;
