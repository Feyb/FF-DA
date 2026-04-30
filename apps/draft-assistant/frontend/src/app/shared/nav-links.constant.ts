import type { NavIconName } from "./components/nav-icon";

export interface NavLink {
  path: string;
  label: string;
  icon: NavIconName;
}

export const NAV_LINKS: NavLink[] = [
  { path: "/home", label: "Home", icon: "home" },
  { path: "/team", label: "Team", icon: "team" },
  { path: "/players", label: "Players", icon: "players" },
  { path: "/draft", label: "Draft", icon: "football" },
];
