export interface CareNote {
  time: string;
  note: string;
  author: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface TodayData {
  careNotes: CareNote[];
  tasks: Task[];
  lastUpdatedBy: string;
  currentCaregiver: string;
}

export const todayData: TodayData = {
  careNotes: [
    {
      time: "8:30 AM",
      note: "Wela enjoyed breakfast this morning. Had a good appetite and seemed happy.",
      author: "Lupe"
    },
    {
      time: "11:15 AM",
      note: "Took a nice walk around the garden together. The sunshine felt good on our faces.",
      author: "Lupe"
    },
    {
      time: "2:00 PM",
      note: "Resting comfortably this afternoon. We chatted a bit and Wela seemed peaceful.",
      author: "Lupe"
    }
  ],
  tasks: [
    {
      id: "1",
      text: "Evening medication",
      completed: false
    },
    {
      id: "2",
      text: "Call doctor's office about appointment",
      completed: false
    }
  ],
  lastUpdatedBy: "Lupe",
  currentCaregiver: "Lupe"
};

