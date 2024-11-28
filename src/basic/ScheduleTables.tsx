import { Button, ButtonGroup, Flex, Heading, Stack } from "@chakra-ui/react";
import ScheduleTable from "./ScheduleTable.tsx";
import { useScheduleContext } from "./ScheduleContext.tsx";
import SearchDialog from "./SearchDialog.tsx";
import { useCallback, useMemo, useState } from "react";

export const ScheduleTables = () => {
  const { schedulesMap, setSchedulesMap } = useScheduleContext();
  const [searchInfo, setSearchInfo] = useState<{
    tableId: string;
    day?: string;
    time?: number;
  } | null>(null);

  const disabledRemoveButton = useMemo(() => Object.keys(schedulesMap).length === 1, [schedulesMap]);

  const handleSearchOpen = useCallback((tableId: string)=> {
    setSearchInfo({ tableId })
  }, []);

  const handleDuplicate = useCallback((targetId: string) => {
    setSchedulesMap(prev => ({
      ...prev,
      [`schedule-${Date.now()}`]: [...prev[targetId]]
    }))
  }, [setSchedulesMap]);

  const handleRemove = useCallback((targetId: string) => {
    setSchedulesMap(prev => {
      delete prev[targetId];
      return { ...prev };
    })
  }, [setSchedulesMap]);

  const handleScheduleTimeClick = useCallback((tableId: string, timeInfo: { day: string; time: number }) => {
    setSearchInfo({ tableId, ...timeInfo });
  }, []);

  const handleDeleteSchedule = useCallback((tableId: string, day: string, time: number) => {
    setSchedulesMap((prev) => ({
      ...prev,
      [tableId]: prev[tableId].filter(schedule => 
        schedule.day !== day || !schedule.range.includes(time)
      )
    }));
  }, [setSchedulesMap]);

  const handleSearchClose = useCallback(() => setSearchInfo(null), []);

  return (
    <>
      <Flex w="full" gap={6} p={6} flexWrap="wrap">
        {Object.entries(schedulesMap).map(([tableId, schedules], index) => (
          <Stack key={tableId} width="600px">
            <Flex justifyContent="space-between" alignItems="center">
              <Heading as="h3" fontSize="lg">시간표 {index + 1}</Heading>
              <ButtonGroup size="sm" isAttached>
                <Button colorScheme="green" onClick={() => handleSearchOpen(tableId)}>시간표 추가</Button>
                <Button colorScheme="green" mx="1px" onClick={() => handleDuplicate(tableId)}>복제</Button>
                <Button colorScheme="green" isDisabled={disabledRemoveButton}
                        onClick={() => handleRemove(tableId)}>삭제</Button>
              </ButtonGroup>
            </Flex>
            <ScheduleTable
              key={`schedule-table-${index}`}
              schedules={schedules}
              tableId={tableId}
              onScheduleTimeClick={(timeInfo) => handleScheduleTimeClick(tableId, timeInfo)}
              onDeleteButtonClick={({ day, time }) => handleDeleteSchedule(tableId, day, time)}
            />
          </Stack>
        ))}
      </Flex>
      <SearchDialog searchInfo={searchInfo} onClose={handleSearchClose}/>
    </>
  );
}
