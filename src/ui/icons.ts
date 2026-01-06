import {
  faNoteSticky,
  faListCheck,
  faUser,
  faUserCheck,
  faArrowRightArrowLeft,
  faClock,
  faClipboard,
  faArrowLeft,
  faSquare,
  faBookOpen,
  faPenToSquare,
  faFileLines,
  faMoon,
  faSun
} from '@fortawesome/free-solid-svg-icons';

export const Icons = {
  note: faNoteSticky,
  tasks: faListCheck,
  caregiver: faUser,
  currentCaregiver: faUserCheck,
  handoff: faArrowRightArrowLeft,
  time: faClock,
  notebook: faClipboard,
  brand: faBookOpen, // Changed from clipboard to book for header
  back: faArrowLeft,
  listItem: faSquare,
  quickNote: faPenToSquare, // Pen icon for Quick note section
  careNotes: faFileLines, // Document icon for Care Notes section
  moon: faMoon,
  sun: faSun,
};

