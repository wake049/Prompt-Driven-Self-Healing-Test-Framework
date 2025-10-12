import React from "react";
export function Button({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`px-3 py-1 rounded-lg border text-sm hover:bg-slate-50 ${className}`} {...props} />;
}
export default Button;