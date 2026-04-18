export interface NavLink {
  path: string;
  label: string;
  icon: string;
}

export const NAV_LINKS: NavLink[] = [
  { path: "/home", label: "Home", icon: "home" },
  { path: "/team", label: "Team", icon: "group" },
  { path: "/players", label: "Players", icon: "format_list_bulleted" },
  { path: "/draft", label: "Draft", icon: "sports_football" },
];
