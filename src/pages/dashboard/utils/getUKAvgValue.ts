export const getUKAvgValue = (
  expense_type: string,
  practiceType: string
): string => {
  const table: Record<string, Record<string, string>> = {
    'Staff Costs': {
      PRIVATE: '18 – 21%',
      MIXED: '20 – 22%',
      'NHS-DOMINANT': '21–23%',
      'Squat / Start-up': '22–30%'
    },
    'Clinician Costs': {
      PRIVATE: '42–50%',
      MIXED: '38–48%',
      'NHS-DOMINANT': '35–45%',
      'SQUAT/START-UP': '35–50%'
    },
    Materials: {
      PRIVATE: '6.0–7.5%',
      MIXED: '5.5–6.5%',
      'NHS-DOMINANT': '4.5–5.5%',
      'SQUAT/START-UP': '6–9%'
    },
    'Lab Fees': {
      PRIVATE: '6.0–7.0%',
      MIXED: '5.0–6.5%',
      'NHS-DOMINANT': '4.0–5.0%',
      'SQUAT/START-UP': '4–7%'
    },
    'Premises & Equipment': {
      PRIVATE: '3.8–4.5%',
      MIXED: '3.8–4.2%',
      'NHS-DOMINANT': '3.6–4.0%',
      'SQUAT/START-UP': '3.5–5.5%'
    },
    Marketing: {
      PRIVATE: '5–8%',
      MIXED: '5–8%',
      'NHS-DOMINANT': '4–7%',
      'SQUAT/START-UP': '10–20%'
    },
    'Net profit margin': {
      PRIVATE: '12–20%',
      MIXED: '12–22%',
      'NHS-DOMINANT': '8–16%',
      'SQUAT/START-UP': '0–10% → 8–15% by Y2'
    }
  }

  const type = practiceType?.trim() || 'NHS-DOMINANT'
  return table[expense_type]?.[type] ?? '—'
}
