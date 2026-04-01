import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-lg shadow-sm p-6",
        className
      )}
      {...props}
    />
  );
}

export { Card };