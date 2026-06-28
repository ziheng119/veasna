import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PageCardProps {
  title: React.ReactNode;
  action?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function PageCard({
  title,
  action,
  headerExtra,
  children,
  className,
  headerClassName,
  contentClassName,
}: PageCardProps) {
  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className={cn("border-b border-border", headerClassName)}>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span>{title}</span>
          {action}
        </CardTitle>
        {headerExtra}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
