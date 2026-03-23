"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, ArrowRightLeft, Loader2, Search, UserPlus } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  advancedSearchTransferInChildren,
  quickSearchTransferInChildren,
  type TransferInSearchResult,
} from "@/lib/api/chw"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const quickSearchSchema = z.object({
  identifier: z.string().trim().min(1, "Child ID or phone is required"),
})

const advancedSearchSchema = z.object({
  childName: z.string().trim().min(1, "Child first name is required"),
  motherName: z.string().trim().min(1, "Mother full name is required"),
  dob: z.string().trim().min(1, "Date of birth is required"),
})

type QuickSearchValues = z.infer<typeof quickSearchSchema>
type AdvancedSearchValues = z.infer<typeof advancedSearchSchema>

type TransferInSearchProps = {
  disabled?: boolean
  onSelectChild: (child: TransferInSearchResult, initiatePull: boolean) => void
}

export function TransferInSearch({ disabled = false, onSelectChild }: TransferInSearchProps) {
  const [activeTab, setActiveTab] = useState<"quick" | "advanced">("quick")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<TransferInSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quickForm = useForm<QuickSearchValues>({
    resolver: zodResolver(quickSearchSchema),
    mode: "onChange",
    defaultValues: {
      identifier: "",
    },
  })

  const advancedForm = useForm<AdvancedSearchValues>({
    resolver: zodResolver(advancedSearchSchema),
    mode: "onChange",
    defaultValues: {
      childName: "",
      motherName: "",
      dob: "",
    },
  })

  const runSearch = async (searchRequest: Promise<TransferInSearchResult[]>) => {
    setSearching(true)
    setError(null)
    setHasSearched(true)

    try {
      const data = await searchRequest
      setResults(data)
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  const handleQuickSearch = async (values: QuickSearchValues) => {
    if (disabled) return
    await runSearch(quickSearchTransferInChildren(values.identifier))
  }

  const handleAdvancedSearch = async (values: AdvancedSearchValues) => {
    if (disabled) return
    await runSearch(
      advancedSearchTransferInChildren({
        childName: values.childName,
        motherName: values.motherName,
        dob: values.dob,
      }),
    )
  }

  const quickIdentifier = quickForm.watch("identifier")

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as "quick" | "advanced")
          setError(null)
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quick">Quick Search</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="space-y-3">
          <form onSubmit={quickForm.handleSubmit(handleQuickSearch)} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="quick-identifier">Phone or Child ID</Label>
              <Input
                id="quick-identifier"
                placeholder="Enter mother phone number or child UUID"
                disabled={disabled || searching}
                {...quickForm.register("identifier")}
              />
            </div>
            <Button
              type="submit"
              disabled={disabled || searching || !quickIdentifier?.trim()}
              className="w-full sm:w-auto"
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-3">
          <form onSubmit={advancedForm.handleSubmit(handleAdvancedSearch)} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="advanced-child-name">Child First Name</Label>
              <Input
                id="advanced-child-name"
                placeholder="e.g. Kofi"
                disabled={disabled || searching}
                {...advancedForm.register("childName")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="advanced-mother-name">Mother Full Name</Label>
              <Input
                id="advanced-mother-name"
                placeholder="e.g. Abena Mensah"
                disabled={disabled || searching}
                {...advancedForm.register("motherName")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="advanced-dob">Date of Birth</Label>
              <Input
                id="advanced-dob"
                type="date"
                disabled={disabled || searching}
                {...advancedForm.register("dob")}
              />
            </div>

            <Button
              type="submit"
              disabled={disabled || searching || !advancedForm.formState.isValid}
              className="w-full sm:w-auto"
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasSearched && !searching && results.length === 0 && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No child matched this search. Try the {activeTab === "quick" ? "advanced" : "quick"} method.
          </AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Found {results.length} child{results.length > 1 ? "ren" : ""}
          </p>

          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {results.map((child) => (
              <div key={child.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{child.childName}</p>
                      {child.requiresPull && (
                        <Badge variant="secondary" className="text-xs">
                          <ArrowRightLeft className="mr-1 h-3 w-3" />
                          Pull Required
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground">Mother: {child.motherName}</p>
                    <p className="text-sm text-muted-foreground">Phone: {child.motherPhone}</p>
                    <p className="text-sm text-muted-foreground">
                      Current Assigned Zone: {child.currentZoneName || "Unassigned"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onSelectChild(child, Boolean(child.requiresPull))}
                  >
                    {child.requiresPull ? (
                      <>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Initiate Transfer Pull
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Select Child
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
