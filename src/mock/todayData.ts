export interface CareNote {
  time: string;
  note: string;
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
      note: "Breakfast completed. Appetite was good today."
    },
    {
      time: "11:15 AM",
      note: "Morning walk around the garden. Weather was pleasant."
    },
    {
      time: "2:00 PM",
      note: "Afternoon rest. Feeling comfortable."
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
  lastUpdatedBy: "Sarah",
  currentCaregiver: "Sarah"
};

