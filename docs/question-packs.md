# 문제집 JSON 규격

시작 화면의 예제 다운로드는 현재 배포된 기본 문제집을 내려받습니다. JSON은 데이터로만 읽으며 HTML이나 코드를 실행하지 않습니다.

```json
{
  "version": 1,
  "title": "My Computer Networks Exam",
  "coverage": ["Chapter 1", "Chapter 2 through DNS"],
  "questions": [
    {"id":"tf-1","type":"true_false","prompt":"TCP provides ordered delivery.","answer":true,"explanation":"TCP orders stream bytes."},
    {"id":"mc-1","type":"multiple_choice","prompt":"Which record carries an IPv4 address?","choices":[{"id":"A","text":"A"},{"id":"B","text":"MX"},{"id":"C","text":"NS"},{"id":"D","text":"CNAME"}],"answer":"A","explanation":"A records contain IPv4 addresses."},
    {"id":"sa-1","type":"short_answer","prompt":"What does DNS stand for?","answers":["Domain Name System"],"explanation":"DNS is the Domain Name System."},
    {"id":"oe-1","type":"open_ended","prompt":"Explain how TCP detects and repairs missing data.","modelAnswer":"TCP tracks acknowledgments and retransmits missing data.","concepts":[["acknowledgments","acknowledgements","ACK","ACKs"],["retransmits","retransmission","resends"]],"explanation":"Acknowledgments and retransmissions support reliable delivery."}
  ]
}
```

## 필수 조건

- 네 유형마다 최소 1개가 필요합니다. 총 2,000문제 이하, 가져오는 파일은 2MB 이하입니다.
- `id`는 전체 문제집에서 고유해야 합니다.
- 모든 문제는 영어 `prompt`, `explanation`이 필요합니다.
- 객관식 선택지는 정확히 4개, 선택지 ID는 고유해야 하며 `answer`는 존재하는 선택지 ID여야 합니다.
- `topic`(짧은 분류)과 `source`(HTTP/S 참고 링크)는 선택 사항입니다.
- `coverage`는 선택 사항인 문자열 배열입니다.

## 입력형 채점

`short_answer.answers`는 허용 정답 목록입니다. 대소문자, 앞뒤·연속 공백, 문장 끝 마침표·느낌표·물음표는 무시합니다.

문장형 단답에는 선택적으로 `concepts`를 추가할 수 있습니다. 정확한 정답 문자열 또는 **모든 핵심어 그룹 충족**이면 통과합니다.

```json
{
  "id":"sa-delay",
  "type":"short_answer",
  "prompt":"State the formula for transmission delay.",
  "answers":["L/R", "d_trans = L/R."],
  "concepts":[["L/R","L divided by R"]],
  "explanation":"Packet length divided by link rate."
}
```

`open_ended.concepts`에서는 바깥 배열이 AND, 안쪽 동의어가 OR입니다. 그룹마다 하나 이상 등장해야 정답입니다. 단어 경계를 확인하며 핵심어 검사에서는 하이픈·구두점을 공백으로 정규화합니다. 자동 어간 추출이나 의미 유사도 검사는 하지 않으므로 필요한 복수형·동의어를 명시하세요.

단답형에 `ordered: true`를 넣으면 핵심어 그룹이 배열 순서대로 나타나야 합니다. 순서가 필요한 계층·필드 목록에만 사용하세요.

모범답안이 각 그룹을 실제로 충족하는지 꼭 확인하세요. 단순히 주제 이름만 요구하면 틀린 답이 통과할 수 있습니다. 예를 들어 queueing delay의 증가를 묻는 문항에는 `queueing delay`만 넣지 말고 `increases`, `grows`, `very large` 등 답의 핵심을 사용합니다.

## 제공한 원본 형식

`metadata`, `true_false`, `multiple_choice`, `short_answer`, `open_ended` 배열로 나뉜 원본도 가져올 수 있습니다. 기본 시험 문제와 ID·문항·모범답안이 일치하면 검수한 채점 동의어를 재사용합니다. 새로운 그룹형 단답 문항은 원본 `answer`와의 문자열 비교를 사용합니다. 유연한 채점이 필요하면 위 정규 형식으로 변환해 `concepts`를 명시하세요.

게임은 문제집을 가져올 때 적용 오류를 보여주며 기존 유효한 문제집을 유지합니다. 데이터는 세션 내에서만 바뀝니다.

## GPT에 전달할 생성 프롬프트

> Create an English computer-networks exam question bank based strictly on the lecture material I provide. Respect my included and excluded topics. Return valid JSON only, using version 1 and a title, optional coverage, and a flat questions array. Include all four types: true_false, multiple_choice, short_answer, and open_ended. Give every question a unique id, prompt, explanation, and optional topic. For true_false, answer is a boolean. For multiple_choice, include exactly four choices with unique id/text fields; answer is the correct choice ID. For short_answer, answers is an array of accepted English strings; optionally add concepts as AND-of-OR keyword groups for descriptive answers. For open_ended, provide modelAnswer and concepts, where each group contains equivalent words or phrases, and every group must be satisfied. Include plural forms, abbreviations, and valid variants explicitly. Do not use topic labels as the only correctness criteria. Make sure every model answer satisfies its own concept groups. Use ordered:true only for short-answer lists whose order is part of correctness. Keep arithmetic, units, and assumptions explicit. Do not include material outside the supplied exam coverage.

## 부분 점수 핵심어 (`minConcepts`)

`short_answer`, `open_ended`에 `minConcepts`(정수)를 넣으면 `concepts` 그룹 중 그 개수 이상만 맞아도 정답입니다. 없으면 모든 그룹이 필요합니다.

## 챕터별 원본 형식

`public/data/manifest.json`의 `chapters` 파일은 아래처럼 `chapter_N` 키로 나눕니다. 각 챕터 안의 형식은 위 "제공한 원본 형식"과 같고, 단답형은 `answer` + `keywords`, 서술형은 `sample_answer` + `required_keywords`를 씁니다.

```json
{
  "metadata": {"title": "..."},
  "chapter_1": {"metadata": {"title": "Chapter 1 - ...", "coverage": "..."}, "true_false": [], "multiple_choice": [], "short_answer": [], "open_ended": []},
  "chapter_2": {"metadata": {"title": "Chapter 2 - ..."}, "true_false": [], "multiple_choice": [], "short_answer": [], "open_ended": []}
}
```

변환 시 문제 문장에 이미 나온 핵심어는 제외하고, 단답형은 남은 핵심어의 50%, 서술형은 60% 이상을 요구합니다(`src/quiz/chapters.ts`). 모든 챕터를 선택하면 `full` 문제집을 사용합니다.

### 챕터 하나짜리 별도 파일 (`extras`)

`manifest.json`의 `extras`에 `{"id":"chapter_2_part1","title":"Chapter 2-1","file":"chapter_2_part1_quiz_160.json"}`처럼 적으면 시작 화면에 칩이 하나 더 생깁니다. 파일은 `metadata`와 `true_false`, `multiple_choice`, `calculation`, `open_ended` 배열을 가집니다(`chapter_N` 키 없이 한 챕터).

- `calculation`: `{ "id", "question", "answer", "solution" }` — 숫자·단위로 채점하는 단답형(Sniper)이 됩니다. `answer`의 첫 숫자와 단위가 정답이고 `About …`은 ±2% 허용입니다.
- `open_ended`: `sample_answer` + `required_keywords`. 문제 문장에 이미 나온 핵심어는 빠지므로, 남는 핵심어가 너무 적으면 `concepts`(동의어 묶음 배열, 예: `[["sender","who sends"],["recipient","receiver"]]`)와 `min_concepts`(필요한 묶음 수)를 직접 적어 채점 기준을 정할 수 있습니다. 직접 적은 기준은 `chapters` 파일의 서술형에도 똑같이 쓸 수 있습니다.
- 파일을 못 읽으면 그 칩만 빠지고 나머지는 정상 동작합니다.
