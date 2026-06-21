"use client"

import { HISTORY, PRESENTING_COMPLAINTS, SNELLENS_TEST, TriageTab } from "@/models/triage/triage_tab"
import Tab from "../shared/Tab"
import SnellensTest from "./SnellensTest"
import PresentingComplaints from "./PresentingComplaints"
import History from "./History"
import { useEffect, useState } from "react"

export default function TraigeTabs() {

  const [activeTab, setActiveTab] = useState<TriageTab>(SNELLENS_TEST)

  const applyTab = (activeTab: TriageTab) => {
    switch (activeTab) {
      case SNELLENS_TEST:
        return <SnellensTest />
      case PRESENTING_COMPLAINTS:
        return <PresentingComplaints />
      case HISTORY:
        return <History />
      default:
        return <SnellensTest />
    }
  }

  useEffect(() => {
    applyTab(activeTab)
  }, [activeTab])

  return (
    <div>
      <div className="flex">
        <Tab
          label="Snellen's Test"
          isActive={activeTab === SNELLENS_TEST}
          onClick={() => setActiveTab(SNELLENS_TEST)}
        />
        <Tab
          label="Presenting Complaints"
          isActive={activeTab === PRESENTING_COMPLAINTS}
          onClick={() => setActiveTab(PRESENTING_COMPLAINTS)}
        />
        <Tab
          label="History"
          isActive={activeTab === HISTORY}
          onClick={() => setActiveTab(HISTORY)}
        />
      </div>

      <div className="bg-beige-default p-7">
        {applyTab(activeTab)}
      </div>
    </div>
  )
}