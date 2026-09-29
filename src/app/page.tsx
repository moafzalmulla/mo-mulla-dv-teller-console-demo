import { TellerConsole } from "@/components/TellerConsole";
import { BankProvider } from "@/state/BankProvider";

export default function HomePage() {
  return (
    <BankProvider>
      <TellerConsole />
    </BankProvider>
  );
}
