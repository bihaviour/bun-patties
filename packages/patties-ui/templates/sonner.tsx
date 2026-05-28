import {
	type ComponentProps,
	type CSSProperties,
	useEffect,
	useState,
} from "react";
import { Toaster as Sonner } from "sonner";

export const island = true as const;

export { toast } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner> & {
	theme?: "light" | "dark" | "system";
};

// Patties reads dark mode from `class="dark"` on <html> — no next-themes.
function useDocumentTheme(): "light" | "dark" {
	const [theme, setTheme] = useState<"light" | "dark">("light");
	useEffect(() => {
		const root = document.documentElement;
		const read = () =>
			setTheme(root.classList.contains("dark") ? "dark" : "light");
		read();
		const observer = new MutationObserver(read);
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);
	return theme;
}

export function Toaster({ theme, ...props }: ToasterProps) {
	const documentTheme = useDocumentTheme();
	return (
		<Sonner
			theme={theme ?? documentTheme}
			className="toaster group"
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
				} as CSSProperties
			}
			{...props}
		/>
	);
}
