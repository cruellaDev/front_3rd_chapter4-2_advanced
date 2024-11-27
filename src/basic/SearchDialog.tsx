import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Table,
  Tbody,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { useScheduleContext } from './ScheduleContext.tsx';
import { Lecture } from './types.ts';
import { parseSchedule } from "./utils.ts";
import { LectureTableRow } from '../lecture/ui/LectureTableRow.tsx';
import { PAGE_SIZE } from '../page/model/constants.ts';
import { createCachedFetch } from '../lecture/api/cachedAPI.ts';
import { matchCredit, matchesSchedule, matchGrade, matchLectureQuery, matchMajor } from '../lecture/model/Lecture.ts';
import { FilterCheckboxGroup } from '../search/ui/FilterCheckboxGroup.tsx';
import { ComplexFilterGroup } from '../search/ui/ComplexFilterGroup.tsx';
import { DAY_OPTIONS, GRADE_OPTIONS, TIME_SLOTS } from '../search/model/constants.ts';

interface Props {
  searchInfo: {
    tableId: string;
    day?: string;
    time?: number;
  } | null;
  onClose: () => void;
}

interface SearchOption {
  query?: string,
  grades: number[],
  days: string[],
  times: number[],
  majors: string[],
  credits?: number,
}

// 개선된 방식 - 캐시를 사용한 효율적인 API 호출
const { fetchMajors, fetchLiberalArts } = createCachedFetch<Lecture[]>();
const fetchAllLecturesEfficient = async () => {
  // 동일하게 6번 호출하지만, 캐시로 인해 실제로는 2번만 네트워크 요청
  const results = await Promise.all([
    (console.log('API Call 1', performance.now()), await fetchMajors()),
    (console.log('API Call 2', performance.now()), await fetchLiberalArts()),
    (console.log('API Call 3', performance.now()), await fetchMajors()),
    (console.log('API Call 4', performance.now()), await fetchLiberalArts()),
    (console.log('API Call 5', performance.now()), await fetchMajors()),
    (console.log('API Call 6', performance.now()), await fetchLiberalArts()),
  ]);
  return results;
};

// TODO: 이 컴포넌트에서 불필요한 연산이 발생하지 않도록 다양한 방식으로 시도해주세요.
const SearchDialog = ({ searchInfo, onClose }: Props) => {
  const { setSchedulesMap } = useScheduleContext();

  const loaderWrapperRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [page, setPage] = useState(1);
  const [searchOptions, setSearchOptions] = useState<SearchOption>({
    query: '',
    grades: [],
    days: [],
    times: [],
    majors: [],
  });

  // 새로운 메모이제이션 코드 추가
  const filteredLectures = useMemo(() => {
    const { query = '', credits, grades, days, times, majors } = searchOptions;
    return lectures.filter(lecture => matchLectureQuery(lecture, query) &&
        matchGrade(lecture.grade, grades) &&
        matchMajor(lecture.major, majors) &&
        matchCredit(lecture.credits, credits) &&
        matchesSchedule(lecture.schedule, days, times));
  }, [lectures, searchOptions]); // lectures나 searchOptions가 변경될 때만 재계산

  const lastPage = useMemo(() => 
    Math.ceil(filteredLectures.length / PAGE_SIZE)
  , [filteredLectures.length]);

  const visibleLectures = useMemo(() => 
    filteredLectures.slice(0, page * PAGE_SIZE)
  , [filteredLectures, page]);

  const allMajors = useMemo(() => 
    [...new Set(lectures.map(lecture => lecture.major))]
  , [lectures]);

  const changeSearchOption = useCallback((field: keyof SearchOption, value: SearchOption[typeof field]) => {
    setPage(1);
    setSearchOptions(prev => ({ ...prev, [field]: value }));
    loaderWrapperRef.current?.scrollTo(0, 0);
  }, []);

  const addSchedule = useCallback((lecture: Lecture) => {
    if (!searchInfo) return;
    const schedules = parseSchedule(lecture.schedule).map(schedule => ({
      ...schedule,
      lecture
    }));
    setSchedulesMap(prev => ({
      ...prev,
      [searchInfo.tableId]: [...prev[searchInfo.tableId], ...schedules]
    }));
    onClose();
  }, [searchInfo, setSchedulesMap, onClose]);

  useEffect(() => {
    const start = performance.now();
    console.log('API 호출 시작: ', start)
    fetchAllLecturesEfficient().then(results => {
      const end = performance.now();
      console.log('모든 API 호출 완료 ', end)
      console.log('API 호출에 걸린 시간(ms): ', end - start)
      setLectures(results.flatMap(result => result.data));
    })
  }, []);

  useEffect(() => {
    const $loader = loaderRef.current;
    const $loaderWrapper = loaderWrapperRef.current;

    if (!$loader || !$loaderWrapper) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setPage(prevPage => Math.min(lastPage, prevPage + 1));
        }
      },
      { threshold: 0, root: $loaderWrapper }
    );

    observer.observe($loader);

    return () => observer.unobserve($loader);
  }, [lastPage]);

  useEffect(() => {
    setSearchOptions(prev => ({
      ...prev,
      days: searchInfo?.day ? [searchInfo.day] : [],
      times: searchInfo?.time ? [searchInfo.time] : [],
    }))
    setPage(1);
  }, [searchInfo]);

  return (
    <Modal isOpen={Boolean(searchInfo)} onClose={onClose} size="6xl">
      <ModalOverlay/>
      <ModalContent maxW="90vw" w="1000px">
        <ModalHeader>수업 검색</ModalHeader>
        <ModalCloseButton/>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <FormControl>
                <FormLabel>검색어</FormLabel>
                <Input
                  placeholder="과목명 또는 과목코드"
                  value={searchOptions.query}
                  onChange={(e) => changeSearchOption('query', e.target.value)}
                />
              </FormControl>

              <FormControl>
                <FormLabel>학점</FormLabel>
                <Select
                  value={searchOptions.credits}
                  onChange={(e) => changeSearchOption('credits', e.target.value)}
                >
                  <option value="">전체</option>
                  <option value="1">1학점</option>
                  <option value="2">2학점</option>
                  <option value="3">3학점</option>
                </Select>
              </FormControl>
            </HStack>

            <HStack spacing={4}>
              <FilterCheckboxGroup
                label="학년"
                name="grades"
                options={GRADE_OPTIONS}
                value={searchOptions.grades}
                onChange={(values) => changeSearchOption('grades', values.map(Number))}
              />

              <FilterCheckboxGroup
                label="요일"
                name="days"
                options={DAY_OPTIONS}
                value={searchOptions.days}
                onChange={(values) => changeSearchOption('days', values as string[])}
              />
            </HStack>

            <HStack spacing={4}>
            <ComplexFilterGroup
              label="시간"
              options={TIME_SLOTS}
              value={searchOptions.times}
              onChange={(values) => changeSearchOption('times', values.map(Number))}
              tagLabelFormatter={(time) => `${time}교시`}
              checkboxLabelFormatter={(option) => `${option.id}교시(${option.label})`}
            />

            <ComplexFilterGroup
              label="전공"
              options={allMajors.map(major => ({ id: major, label: major }))}
              value={searchOptions.majors}
              onChange={(values) => changeSearchOption('majors', values as string[])}
              tagLabelFormatter={(major) => String(major).split("<p>").pop() || ''}
              checkboxLabelFormatter={(option) => option.label.replace(/<p>/gi, ' ')}
            />
            </HStack>
            <Text align="right">
              검색결과: {filteredLectures.length}개
            </Text>
            <Box>
              <Table>
                <Thead>
                  <Tr>
                    <Th width="100px">과목코드</Th>
                    <Th width="50px">학년</Th>
                    <Th width="200px">과목명</Th>
                    <Th width="50px">학점</Th>
                    <Th width="150px">전공</Th>
                    <Th width="150px">시간</Th>
                    <Th width="80px"></Th>
                  </Tr>
                </Thead>
              </Table>

              <Box overflowY="auto" maxH="500px" ref={loaderWrapperRef}>
                <Table size="sm" variant="striped">
                  <Tbody>
                    {visibleLectures.map((lecture, index) => (
                      <LectureTableRow 
                        key={`${lecture.id}-${index}`}
                        lecture={lecture}
                        onAddSchedule={addSchedule}
                      />
                    ))}
                  </Tbody>
                </Table>
                <Box ref={loaderRef} h="20px"/>
              </Box>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SearchDialog;