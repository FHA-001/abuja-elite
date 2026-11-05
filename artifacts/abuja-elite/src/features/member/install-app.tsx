import { Share, SquarePlus } from "lucide-react";
import { dismissInstallCard, promptInstall, useInstallState } from "@/lib/install-prompt";

/** Offers to put Abuja Elite on the phone's home screen. Appears only when it can actually work. */
export function InstallApp() {
  const state = useInstallState();
  if (state === "hidden") return null;
  return (
    <section className="member-card install-card" aria-label="Add Abuja Elite to your phone">
      <div>
        <p className="eyebrow">Get the app</p>
        <h2 className="display-font">Keep Abuja Elite on your phone.</h2>
        {state === "button" ? (
          <p className="body-copy">One tap adds it to your home screen, so your account, events and community open like an app.</p>
        ) : (
          <ol className="install-steps">
            <li>Tap the <Share size={16} aria-label="Share" className="install-icon" /> <strong>Share</strong> button at the bottom of Safari.</li>
            <li>Choose <SquarePlus size={16} aria-label="Add" className="install-icon" /> <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>. Abuja Elite now opens like an app.</li>
          </ol>
        )}
      </div>
      <div className="install-actions">
        {state === "button" && <button className="gold-button" onClick={() => void promptInstall()}>Add to home screen</button>}
        <button className="outline-button" onClick={dismissInstallCard}>Not now</button>
      </div>
    </section>
  );
}
