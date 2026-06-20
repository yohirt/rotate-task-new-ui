const segmentColors = [
  "#20bdbd",
  "#7fd2ff",
  "#2f8df0",
  "#246fd7",
  "#ffd74d",
  "#56cfc5",
  "#18afa9",
  "#8ad8ff",
];

const taskColorByKeyword = [
  { keywords: ["nauka", "czytanie", "mianowania"], color: "#7fd2ff" },
  { keywords: ["sprzatanie", "sprzątanie", "porzadek", "porządek"], color: "#56cfc5" },
  { keywords: ["drums", "muzyka", "werbel"], color: "#246fd7" },
  { keywords: ["trening", "cwiczenia", "ćwiczenia", "rozgrzewka"], color: "#2f8df0" },
  { keywords: ["praca", "projekt"], color: "#20bdbd" },
  { keywords: ["lunch", "kawa", "posilek", "posiłek"], color: "#ffd74d" },
  { keywords: ["relaks", "spacer", "uwaznosc", "uważność"], color: "#8ad8ff" },
];

const taskColorByIcon = {
  "\u{1F4DA}": "#7fd2ff",
  "\u{1F9F9}": "#56cfc5",
  "\u{1F941}": "#246fd7",
  "\u{1F3C3}": "#2f8df0",
  "\u{1F4BB}": "#20bdbd",
  "\u{1F374}": "#ffd74d",
  "\u{1F4D6}": "#7fd2ff",
  "\u{1F33F}": "#8ad8ff",
};

export const getTaskColor = (task, index) => {
  if (taskColorByIcon[task.icon]) {
    return taskColorByIcon[task.icon];
  }

  const title = task.title.toLocaleLowerCase("pl-PL");
  const matched = taskColorByKeyword.find(({ keywords }) =>
    keywords.some((keyword) => title.includes(keyword))
  );

  return matched?.color ?? segmentColors[index % segmentColors.length];
};
