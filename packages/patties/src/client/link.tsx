import type * as React from "react";
import { canSoftNavigate, navigate, prefetch } from "./page.ts";

export interface LinkProps
	extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
	href: string;
	// Replace the current history entry instead of pushing a new one.
	replace?: boolean;
	// "intent" warms the target's payload + chunk on hover/focus.
	prefetch?: "intent" | "none";
	ref?: React.Ref<HTMLAnchorElement>;
}

// A plain <a> that upgrades to a client-side transition on hydrated pages.
// Without a booted page runtime (zero-JS or island pages) it is an ordinary
// link, so it SSRs and degrades without JavaScript.
export function Link({
	href,
	replace,
	prefetch: prefetchMode = "intent",
	onClick,
	onMouseEnter,
	onFocus,
	...rest
}: LinkProps) {
	const warm = () => {
		if (prefetchMode === "intent") prefetch(href);
	};
	return (
		<a
			{...rest}
			href={href}
			onMouseEnter={(e) => {
				onMouseEnter?.(e);
				warm();
			}}
			onFocus={(e) => {
				onFocus?.(e);
				warm();
			}}
			onClick={(e) => {
				onClick?.(e);
				if (
					e.defaultPrevented ||
					e.button !== 0 ||
					e.metaKey ||
					e.ctrlKey ||
					e.shiftKey ||
					e.altKey ||
					(rest.target && rest.target !== "_self") ||
					rest.download !== undefined ||
					!canSoftNavigate(href)
				) {
					return;
				}
				e.preventDefault();
				void navigate(href, { replace });
			}}
		/>
	);
}
