import { DirectionProvider as RadixDirectionProvider } from "@radix-ui/react-direction";
import type { ReactNode } from "react";

export const island = false as const;

export function DirectionProvider({
	dir,
	children,
}: {
	dir: "ltr" | "rtl";
	children?: ReactNode;
}) {
	return <RadixDirectionProvider dir={dir}>{children}</RadixDirectionProvider>;
}
