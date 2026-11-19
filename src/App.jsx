import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout, { LegalLayout } from './components/AdminLayout'
import ConsentGate from './components/ConsentGate'
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute'
import Account from './pages/Account'
import ActivityLogDetail from './pages/ActivityLogDetail'
import ActivityLogs from './pages/ActivityLogs'
import BankMaster from './pages/BankMaster'
import CategoryMaster from './pages/CategoryMaster'
import Contact from './pages/Contact'
import CustomFormDetail from './pages/CustomFormDetail'
import CustomForms from './pages/CustomForms'
import Dashboard from './pages/Dashboard'
import DepositWithdraw from './pages/DepositWithdraw'
import ForgotPassword from './pages/ForgotPassword'
import GeneralLedger from './pages/GeneralLedger'
import IncomeExpense from './pages/IncomeExpense'
import LedgerStatement from './pages/LedgerStatement'
import LendingBorrowing from './pages/LendingBorrowing'
import Login from './pages/Login'
import PrivacyPolicy from './pages/PrivacyPolicy'
import ResetPassword from './pages/ResetPassword'
import SelfTransfer from './pages/SelfTransfer'
import Signup from './pages/Signup'
import Terms from './pages/Terms'

export default function App() {
  return (
    <>
      <ConsentGate />
      <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<LegalLayout />}>
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="income-expense" element={<IncomeExpense />} />
          <Route path="lending-borrowing" element={<LendingBorrowing />} />
          <Route path="deposite-withdraw" element={<DepositWithdraw />} />
          <Route path="self-transfer" element={<SelfTransfer />} />
          <Route path="custom-form" element={<CustomForms />} />
          <Route path="custom-form/:id" element={<CustomFormDetail />} />
          <Route path="masters/category" element={<CategoryMaster />} />
          <Route path="masters/bank" element={<BankMaster />} />
          <Route path="reports/general-ledger" element={<GeneralLedger />} />
          <Route path="reports/ledger-statement" element={<LedgerStatement />} />
          <Route path="activity-logs" element={<ActivityLogs />} />
          <Route path="activity-logs/:id" element={<ActivityLogDetail />} />
          <Route path="account" element={<Account />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  )
}
