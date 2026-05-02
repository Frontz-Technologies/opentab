"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export type PasswordInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "type"
>;

export function PasswordInput({ className, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  const t = useTranslations("common");
  const Icon = visible ? EyeOff : Eye;
  return (
    <InputGroup className={className}>
      <InputGroupInput {...rest} type={visible ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
        >
          <Icon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
