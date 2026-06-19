/**
 * Zarządzanie sesjami czasowymi dla zadań
 * Sesja to okres aktywności na danym zadaniu
 */

const getLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Oblicza czas trwania sesji w minutach
 * @param {Date} startTime - czas rozpoczęcia
 * @param {Date} endTime - czas zakończenia
 * @returns {number} czas w sekundach
 */
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  return Math.max(0, Math.floor((endTime - startTime) / 1000));
};

/**
 * Tworzy nową sesję
 * @param {Date} startTime - czas rozpoczęcia
 * @returns {object} obiekt sesji
 */
export const createSession = (startTime) => {
  return {
    startTime: startTime.toISOString(),
    endTime: null,
    duration: 0,
    durationSeconds: 0,
    date: getLocalDateKey(startTime), // YYYY-MM-DD (lokalna data)
  };
};

/**
 * Kończy sesję i oblicza czas trwania
 * @param {object} session - sesja do zakończenia
 * @param {Date} endTime - czas zakończenia
 * @returns {object} zakończona sesja z czasem trwania
 */
export const endSession = (session, endTime) => {
  if (!session) return null;
  
  const start = new Date(session.startTime);
  const durationSeconds = calculateDuration(start, endTime);
  
  return {
    ...session,
    date: session.date || getLocalDateKey(start),
    endTime: endTime.toISOString(),
    duration: Math.round(durationSeconds / 60),
    durationSeconds,
  };
};

/**
 * Dodaje zakończoną sesję do tablicy sesji tasku
 * @param {object} task - zadanie
 * @param {object} completedSession - zakończona sesja
 * @returns {object} zaktualizowane zadanie
 */
export const addSessionToTask = (task, completedSession) => {
  return {
    ...task,
    sessions: [...(task.sessions || []), completedSession],
  };
};

/**
 * Oblicza całkowity czas spędzony na zadaniu w danym dniu
 * @param {object} task - zadanie
 * @param {string} date - data w formacie YYYY-MM-DD
 * @returns {number} czas w sekundach
 */
export const getDailyDuration = (task, date) => {
  if (!task.sessions || task.sessions.length === 0) return 0;
  
  return task.sessions
    .filter((session) => session.date === date)
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

/**
 * Oblicza całkowity czas spędzony na zadaniu w danym miesiącu
 * @param {object} task - zadanie
 * @param {string} yearMonth - data w formacie YYYY-MM
 * @returns {number} czas w sekundach
 */
export const getMonthlyDuration = (task, yearMonth) => {
  if (!task.sessions || task.sessions.length === 0) return 0;
  
  return task.sessions
    .filter((session) => session.date.startsWith(yearMonth))
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

/**
 * Pobiera wszystkie sesje dla dnia
 * @param {array} tasks - tablica zadań
 * @param {string} date - data w formacie YYYY-MM-DD
 * @returns {array} sesje z info o taskach
 */
export const getDailySessions = (tasks, date) => {
  return tasks
    .flatMap((task) =>
      (task.sessions || [])
        .filter((session) => session.date === date)
        .map((session) => ({
          ...session,
          taskId: task.id,
          taskTitle: task.title,
          taskIcon: task.icon,
        }))
    )
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
};

/**
 * Formatuje czas w sekundach na czytelny format
 * @param {number} totalSeconds - czas w sekundach
 * @returns {string} sformatowany czas (np. "1h 30m")
 */
export const formatDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  
  return `${secs}s`;
};

/**
 * Formatuje datę z ISO do czytelnego formatu
 * @param {string} isoString - data w formacie ISO
 * @returns {string} sformatowana data
 */
export const formatTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
};
