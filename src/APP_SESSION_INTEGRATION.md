# Integracja śledzenia sesji w App.jsx

## Koncepcja

Kiedy użytkownik kliknie na inne zadanie:
1. **Zatrzymać sesję** dla poprzedniego zadania
2. **Zapisać** ją w tablicy `sessions` tamtego tasku
3. **Rozpocząć nową sesję** dla wybranego zadania

## Zmiany w App.jsx

### 1. Import funkcji do śledzenia sesji
```javascript
import { 
  createSession, 
  endSession, 
  addSessionToTask,
  getDailyDuration,
  formatDuration 
} from "./utils/sessionTracker";
```

### 2. Dodaj stan dla aktualnej sesji
```javascript
const [currentSession, setCurrentSession] = useState(null);
```

### 3. Logika przy zmianie zadania (w useEffect)

```javascript
useEffect(() => {
  // Jeśli poprzednie zadanie ma aktywną sesję - zapisz ją
  if (currentSession && activeIndex !== previousIndex) {
    const completedSession = endSession(currentSession, new Date());
    
    setTasks((prevTasks) =>
      prevTasks.map((task, index) => {
        if (index === previousIndex) {
          return addSessionToTask(task, completedSession);
        }
        return task;
      })
    );
  }

  // Rozpocznij nową sesję dla nowego zadania
  setCurrentSession(createSession(new Date()));
  setPreviousIndex(activeIndex);
}, [activeIndex]);
```

### 4. Obsługa zamknięcia okna / zmiany strony
```javascript
useEffect(() => {
  return () => {
    // Zapisz sesję przed zamknięciem
    if (currentSession) {
      const completedSession = endSession(currentSession, new Date());
      saveTasks(
        tasks.map((task, index) => {
          if (index === activeIndex) {
            return addSessionToTask(task, completedSession);
          }
          return task;
        })
      );
    }
  };
}, [currentSession, activeIndex, tasks]);
```

## Struktura sesji w initialTasks

Każdy task będzie miał:
```javascript
sessions: [
  {
    startTime: "2026-06-19T10:30:00.000Z",
    endTime: "2026-06-19T10:45:00.000Z",
    duration: 15,  // minuty
    date: "2026-06-19"
  },
  {
    startTime: "2026-06-19T15:20:00.000Z",
    endTime: "2026-06-19T15:50:00.000Z",
    duration: 30,
    date: "2026-06-19"
  }
]
```

## Wyświetlanie statystyk w TaskPanel

W TaskPanel możemy pokazać:
```javascript
const dailyDuration = getDailyDuration(task, new Date().toISOString().split('T')[0]);

<span>⏱️ Dzisiaj: {formatDuration(dailyDuration)}</span>
```

## Dodatkowe możliwości

- `getDailySessions(tasks, date)` - wszystkie sesje z danego dnia
- `getMonthlyDuration(task, "2026-06")` - czas w miesiącu
- `formatDuration(minutes)` - formatowanie czasu (1h 30m)

