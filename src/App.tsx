import { ThemeProvider } from "./useTheme";
import { NavBar } from "./components/NavBar";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { Formulas } from "./components/Formulas";
import { Footer } from "./components/Footer";
import RetirementPlanner from "./RetirementPlanner";

export default function App() {
  return (
    <ThemeProvider>
      <NavBar />
      <main>
        <Hero />
        <RetirementPlanner />
        <HowItWorks />
        <Formulas />
      </main>
      <Footer />
    </ThemeProvider>
  );
}
