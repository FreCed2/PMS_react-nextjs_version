"use client"; // ✅ This ensures it's a Client Component

import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";

export default function TooltipProvider() {
  return <Tooltip id="global-tooltip" />;
}
