import { Link } from "react-router-dom";
import HomeIcon from "./HomeIcon";

const HOME_LABEL = "Home";

export default function HomeLink({ className = "" }) {
  return (
    <Link
      to="/"
      className={`btn workspace-guide-link${className ? ` ${className}` : ""}`}
      title={HOME_LABEL}
      aria-label={HOME_LABEL}
    >
      <HomeIcon size={20} />
    </Link>
  );
}
