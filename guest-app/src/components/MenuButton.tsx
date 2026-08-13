import { useNavigate } from "react-router-dom";

interface MenuButtonProps {
  label?: string;
}

/**
 * Guest flow step 1 (Home Screen): the single big centered button
 * that takes the guest into the category list ("/menu").
 */
export default function MenuButton({ label = "MENU" }: MenuButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="home__menu-button"
      onClick={() => navigate("/menu")}
    >
      {label}
    </button>
  );
}