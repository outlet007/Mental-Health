(function () {
  const PAGE_SIZE_OPTIONS = [20, 40, 60]
  const DEFAULT_PAGE_SIZE = 20

  function getRows(table) {
    const body = table.tBodies && table.tBodies[0]
    if (!body) return []
    return Array.from(body.rows).filter(row => !row.dataset.paginationEmptyRow)
  }

  function createIcon(name) {
    const icon = document.createElement('i')
    icon.setAttribute('data-lucide', name)
    icon.style.width = '16px'
    icon.style.height = '16px'
    return icon
  }

  function button(label, disabled, active, onClick, ariaLabel) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'table-pagination-link'
    if (active) btn.classList.add('active')
    if (disabled) {
      btn.classList.add('disabled')
      btn.setAttribute('aria-disabled', 'true')
    }
    if (ariaLabel) btn.setAttribute('aria-label', ariaLabel)
    if (label instanceof Node) btn.append(label)
    else btn.textContent = label
    btn.addEventListener('click', () => {
      if (!disabled) onClick()
    })
    return btn
  }

  function pageItems(page, totalPages) {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)

    const items = [1]
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)

    if (start > 2) items.push('ellipsis')
    for (let current = start; current <= end; current += 1) items.push(current)
    if (end < totalPages - 1) items.push('ellipsis')
    items.push(totalPages)

    return items
  }

  function initTable(table, index) {
    if (table.dataset.tablePagination === 'server' || table.dataset.tablePagination === 'ignore') return
    if (table.dataset.tablePaginationReady === 'true') return

    const rows = getRows(table)
    if (rows.length <= DEFAULT_PAGE_SIZE) return

    table.dataset.tablePaginationReady = 'true'

    let page = 1
    let pageSize = DEFAULT_PAGE_SIZE
    const shell = document.createElement('div')
    shell.className = 'table-pagination-shell'
    shell.dataset.tablePaginationControl = String(index)

    const tableWrapper = table.parentElement
    if (tableWrapper && tableWrapper !== document.body) tableWrapper.insertAdjacentElement('afterend', shell)
    else table.insertAdjacentElement('afterend', shell)

    function render() {
      const totalRows = rows.length
      const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
      page = Math.min(page, totalPages)
      const start = (page - 1) * pageSize
      const end = Math.min(start + pageSize, totalRows)

      rows.forEach((row, rowIndex) => {
        row.hidden = rowIndex < start || rowIndex >= end
      })

      shell.innerHTML = ''

      const results = document.createElement('div')
      results.className = 'table-pagination-results'
      const count = document.createElement('span')
      count.textContent = `Results: ${start + 1} - ${end} of ${totalRows}`
      const select = document.createElement('select')
      select.className = 'table-pagination-size'
      select.setAttribute('aria-label', 'Rows per page')
      PAGE_SIZE_OPTIONS.forEach(option => {
        const item = document.createElement('option')
        item.value = String(option)
        item.textContent = String(option)
        item.selected = option === pageSize
        select.append(item)
      })
      select.addEventListener('change', () => {
        pageSize = Number(select.value) || DEFAULT_PAGE_SIZE
        page = 1
        render()
      })
      results.append(count, select)

      const nav = document.createElement('nav')
      nav.className = 'table-pagination-nav'
      nav.setAttribute('aria-label', 'Table pagination')
      nav.append(button(createIcon('chevron-left'), page === 1, false, () => { page -= 1; render() }, 'Previous page'))

      pageItems(page, totalPages).forEach(item => {
        if (item === 'ellipsis') {
          const span = document.createElement('span')
          span.className = 'table-pagination-ellipsis'
          span.textContent = '...'
          nav.append(span)
        } else {
          nav.append(button(String(item), false, item === page, () => { page = item; render() }))
        }
      })

      nav.append(button(createIcon('chevron-right'), page === totalPages, false, () => { page += 1; render() }, 'Next page'))
      shell.append(results, nav)

      if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons()
    }

    render()
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('table').forEach(initTable)
  })
})()