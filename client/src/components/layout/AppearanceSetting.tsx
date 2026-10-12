import { ListGroup, SegmentedControl } from "@/components/ios";
import { useTheme } from "@/contexts/ThemeContext";
import { THEME_CHOICES } from "@/lib/theme";

/**
 * "Appearance" card for the Settings page: white (the default), dark, or follow the device.
 * The look changes the moment it is tapped, and the choice is saved on this device, so it needs no sign-in.
 */
export function AppearanceSetting() {
  const { preference, setPreference } = useTheme();
  return (
    <ListGroup header="Appearance" footer="White is the default. Auto follows your device’s own light or dark setting. Saved on this device only.">
      <div className="p-4">
        <SegmentedControl aria-label="Colour of the website" value={preference} onChange={setPreference} options={THEME_CHOICES} />
      </div>
    </ListGroup>
  );
}
