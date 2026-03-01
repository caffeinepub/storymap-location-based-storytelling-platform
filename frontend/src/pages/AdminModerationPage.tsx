import { useState } from 'react';
import { useGetReports, useRemoveReport, useRemoveStory, useIsCallerAdmin, useGetStoryById } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Trash2, Eye, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import StoryDetailDialog from '../components/StoryDetailDialog';

export default function AdminModerationPage() {
  const { data: isAdmin, isLoading: adminCheckLoading } = useIsCallerAdmin();
  const { data: reports = [], isLoading: reportsLoading, error: reportsError, refetch } = useGetReports();
  const removeReportMutation = useRemoveReport();
  const removeStoryMutation = useRemoveStory();
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  
  // Fetch the selected story data
  const { data: selectedStory } = useGetStoryById(selectedStoryId);

  // Show loading state while checking admin status
  if (adminCheckLoading) {
    return (
      <div className="container px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="container px-4 py-16">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to access the admin moderation dashboard. Only administrators can view and manage reports.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleDismissReport = async (reportId: bigint) => {
    try {
      await removeReportMutation.mutateAsync(reportId);
    } catch (error) {
      // Error is handled by the mutation's onError
    }
  };

  const handleDeleteStory = async (storyId: string, reportId: bigint) => {
    if (!confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return;
    }

    try {
      await removeStoryMutation.mutateAsync(storyId);
      // After deleting the story, also dismiss the report
      await removeReportMutation.mutateAsync(reportId);
    } catch (error) {
      // Errors are handled by the mutations' onError
    }
  };

  const handleViewStory = (storyId: string) => {
    setSelectedStoryId(storyId);
  };

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Moderation Dashboard</h1>
        <p className="text-muted-foreground">Review and manage reported stories</p>
      </div>

      {reportsLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-muted-foreground">Loading reports...</p>
          </div>
        </div>
      )}

      {reportsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Reports</AlertTitle>
          <AlertDescription>
            Failed to load reports. Please try again.
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!reportsLoading && !reportsError && reports.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No Reports</h3>
                <p className="text-muted-foreground">There are currently no reports to review. Great job keeping the community safe!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!reportsLoading && !reportsError && reports.length > 0 && (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={Number(report.id)} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">Report #{Number(report.id)}</CardTitle>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">Story ID: {report.storyId}</Badge>
                      <Badge variant="outline">
                        {new Date(Number(report.timestamp) / 1000000).toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Reason:</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">{report.reason}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewStory(report.storyId)}
                      disabled={removeStoryMutation.isPending}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Story
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDismissReport(report.id)}
                      disabled={removeReportMutation.isPending || removeStoryMutation.isPending}
                    >
                      {removeReportMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Dismissing...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Dismiss Report
                        </>
                      )}
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteStory(report.storyId, report.id)}
                      disabled={removeReportMutation.isPending || removeStoryMutation.isPending}
                    >
                      {removeStoryMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Story
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedStoryId && (
        <StoryDetailDialog
          story={selectedStory || null}
          open={!!selectedStoryId}
          onOpenChange={(open) => !open && setSelectedStoryId(null)}
          userLocation={null}
          onStoryDeleted={() => {
            setSelectedStoryId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
