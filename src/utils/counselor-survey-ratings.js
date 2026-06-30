function numericRating(value) {
  const rating = Number(value)
  return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null
}

function attachSurveyRatingsToCounselors(counselors, surveys) {
  const grouped = new Map()
  const counselorIds = new Set(counselors.map(counselor => counselor.id))

  surveys.forEach(survey => {
    const rating = numericRating(survey.rating)
    if (!survey.counselorId || !counselorIds.has(survey.counselorId) || rating === null) return
    const current = grouped.get(survey.counselorId) || { sum: 0, count: 0 }
    current.sum += rating
    current.count += 1
    grouped.set(survey.counselorId, current)
  })

  const enriched = counselors.map(counselor => {
    const stats = grouped.get(counselor.id)
    if (!stats || !stats.count) return { ...counselor }
    return {
      ...counselor,
      rating: Number((stats.sum / stats.count).toFixed(1)),
      reviewCount: stats.count,
      ratingSource: 'surveys',
    }
  })

  const totals = Array.from(grouped.values()).reduce((acc, stats) => {
    acc.sum += stats.sum
    acc.count += stats.count
    return acc
  }, { sum: 0, count: 0 })

  return {
    counselors: enriched,
    averageRating: totals.count ? (totals.sum / totals.count).toFixed(1) : null,
    reviewCount: totals.count,
  }
}

module.exports = { attachSurveyRatingsToCounselors }


