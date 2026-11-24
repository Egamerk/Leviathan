/**
 * Design tokens. UI components read colours, fonts and spacing from here so a
 * restyle never means editing every component.
 */
export const Theme = {
	colors: {
		background: Color3.fromRGB(8, 14, 20),
		surface: Color3.fromRGB(14, 24, 32),
		text: Color3.fromRGB(225, 235, 240),
		textMuted: Color3.fromRGB(130, 145, 155),
		accent: Color3.fromRGB(80, 200, 255),
		danger: Color3.fromRGB(200, 60, 70),
	},
	fonts: {
		body: Font.fromEnum(Enum.Font.GothamMedium),
		heading: Font.fromEnum(Enum.Font.GothamBold),
	},
	spacing: {
		xs: 4,
		sm: 8,
		md: 12,
		lg: 16,
		xl: 24,
	},
} as const;
