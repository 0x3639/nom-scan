import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { Footer } from "./Footer";
import styles from "./RootLayout.module.css";

export function RootLayout() {
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main">Skip to content</a>
      <TopNav />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
