import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  advancedSearchTransferInChildren,
  quickSearchTransferInChildren,
  type TransferInSearchResult,
} from '@/lib/api/chw'
import { TransferInSearch } from '@/components/chw/transfer-in-search'

jest.mock('@/lib/api/chw', () => ({
  quickSearchTransferInChildren: jest.fn(),
  advancedSearchTransferInChildren: jest.fn(),
}))

const mockQuickSearch = quickSearchTransferInChildren as jest.MockedFunction<
  typeof quickSearchTransferInChildren
>
const mockAdvancedSearch = advancedSearchTransferInChildren as jest.MockedFunction<
  typeof advancedSearchTransferInChildren
>

const withPullResult: TransferInSearchResult = {
  id: 'child-1',
  childId: 'CVCC-001',
  childName: 'Kofi Mensah',
  motherName: 'Ama Mensah',
  motherPhone: '0551234567',
  nextVaccine: 'Penta 2',
  village: 'Madina',
  dateOfBirth: '2023-01-15',
  gender: 'male',
  catchmentAreaId: 'catchment-1',
  currentZoneName: 'Ablekuma Zone',
  currentBranchId: 'branch-1',
  requiresPull: true,
}

const withoutPullResult: TransferInSearchResult = {
  id: 'child-2',
  childId: 'CVCC-002',
  childName: 'Abena Owusu',
  motherName: 'Efua Owusu',
  motherPhone: '0240001111',
  nextVaccine: 'OPV 3',
  village: 'Nungua',
  dateOfBirth: '2022-05-16',
  gender: 'female',
  catchmentAreaId: 'catchment-2',
  currentZoneName: 'Nungua Zone',
  currentBranchId: 'branch-2',
  requiresPull: false,
}

describe('TransferInSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps advanced search button disabled until all 3 fields are filled', async () => {
    const user = userEvent.setup()
    render(<TransferInSearch onSelectChild={jest.fn()} />)

    await user.click(screen.getByRole('tab', { name: 'Advanced Search' }))

    const submitButton = screen.getByRole('button', { name: /^Search$/i })
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText('Child First Name'), 'Abena')
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText('Mother Full Name'), 'Efua Owusu')
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText('Date of Birth'), '2022-05-16')

    await waitFor(() => {
      expect(submitButton).toBeEnabled()
    })
  })

  it('renders pull trigger for child assigned to another zone', async () => {
    const user = userEvent.setup()
    const onSelectChild = jest.fn()
    mockQuickSearch.mockResolvedValue([withPullResult])

    render(<TransferInSearch onSelectChild={onSelectChild} />)

    await user.type(screen.getByLabelText('Phone or Child ID'), '0551234567')
    await user.click(screen.getByRole('button', { name: /^Search$/i }))

    expect(mockQuickSearch).toHaveBeenCalledWith('0551234567')

    expect(await screen.findByText('Kofi Mensah')).toBeInTheDocument()
    expect(screen.getByText('Current Assigned Zone: Ablekuma Zone')).toBeInTheDocument()

    const pullButton = screen.getByRole('button', { name: 'Initiate Transfer Pull' })
    expect(pullButton).toBeInTheDocument()

    await user.click(pullButton)

    expect(onSelectChild).toHaveBeenCalledWith(withPullResult, true)
  })

  it('submits advanced search and selects normal transfer when pull is not required', async () => {
    const user = userEvent.setup()
    const onSelectChild = jest.fn()
    mockAdvancedSearch.mockResolvedValue([withoutPullResult])

    render(<TransferInSearch onSelectChild={onSelectChild} />)

    await user.click(screen.getByRole('tab', { name: 'Advanced Search' }))
    await user.type(screen.getByLabelText('Child First Name'), 'Abena')
    await user.type(screen.getByLabelText('Mother Full Name'), 'Efua Owusu')
    await user.type(screen.getByLabelText('Date of Birth'), '2022-05-16')

    await user.click(screen.getByRole('button', { name: /^Search$/i }))

    expect(mockAdvancedSearch).toHaveBeenCalledWith({
      childName: 'Abena',
      motherName: 'Efua Owusu',
      dob: '2022-05-16',
    })

    expect(await screen.findByText('Abena Owusu')).toBeInTheDocument()
    const selectButton = screen.getByRole('button', { name: 'Select Child' })

    await user.click(selectButton)

    expect(onSelectChild).toHaveBeenCalledWith(withoutPullResult, false)
  })
})
