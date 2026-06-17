const boardEl = document.getElementById("chess-board");
const turnEl = document.getElementById("current-turn");
const capByBlackEl = document.getElementById("captured-by-black");
const capByWhiteEl = document.getElementById("captured-by-white");

let turn = "white"; 
let selectedTile = null;
let possibleMoves = [];
let isAiThinking = false;
let gameActive = true; 

// ★ 직전 이동 기록 추적 변수 (시작지점과 도착지점을 기록)
let lastMove = null; 

// ★ 먹힌 기물들을 담아둘 창고
let capturedByBlack = []; // 컴퓨터가 먹은 플레이어 기물
let capturedByWhite = []; // 플레이어가 먹은 컴퓨터 기물

const PIECES = {
    black: { r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟' },
    white: { r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟' } 
};

const PIECE_VALUES = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 9000 };

let boardState = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    ['',   '',   '',   '',   '',   '',   '',   ''],
    ['',   '',   '',   '',   '',   '',   '',   ''],
    ['',   '',   '',   '',   '',   '',   '',   ''],
    ['',   '',   '',   '',   '',   '',   '',   ''],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

function createBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const tile = document.createElement("div");
            tile.classList.add("tile");
            tile.classList.add((r + c) % 2 === 0 ? "light" : "dark");
            
            tile.dataset.row = r;
            tile.dataset.col = c;

            const pieceCode = boardState[r][c];
            if (pieceCode) {
                const color = pieceCode[0] === 'w' ? 'white' : 'black';
                const type = pieceCode[1];
                tile.innerText = PIECES[color][type];
                tile.dataset.color = color;
                tile.classList.add(color === 'white' ? 'p-white' : 'p-black');
            }

            // ★ 직전 이동 경로 하이라이트 주입
            if (lastMove && ((r === lastMove.fromR && c === lastMove.fromC) || (r === lastMove.toR && c === lastMove.toC))) {
                tile.classList.add("last-move");
            }

            tile.addEventListener("click", onTileClick);
            boardEl.appendChild(tile);
        }
    }
    
    // ★ 전황판 텍스트 실시간 렌더링
    updateCapturedDisplay();
}

// 사망 기물 표시판 갱신 모듈
function updateCapturedDisplay() {
    capByBlackEl.innerText = capturedByBlack.map(p => PIECES.white[p]).join(" ");
    capByWhiteEl.innerText = capturedByWhite.map(p => PIECES.black[p]).join(" ");
}

function onTileClick(e) {
    if (!gameActive || turn === "black" || isAiThinking) return;

    const tile = e.currentTarget;
    const r = parseInt(tile.dataset.row);
    const c = parseInt(tile.dataset.col);

    if (tile.classList.contains("suggested")) {
        movePiece(selectedTile.r, selectedTile.c, r, c);
        clearHighlights();
        return;
    }

    clearHighlights();

    if (tile.dataset.color === "white") {
        selectedTile = { r, c };
        tile.classList.add("selected");
        possibleMoves = calculateMoves(r, c, boardState);
        showSuggestions();
    } else {
        selectedTile = null;
    }
}

function movePiece(fromR, fromC, toR, toC) {
    const targetPiece = boardState[toR][toC];
    
    // 플레이어가 기물을 포획했을 경우 창고에 적재
    if (targetPiece && targetPiece[0] === 'b') {
        capturedByWhite.push(targetPiece[1]);
    }

    // 직전 위치값 세팅
    lastMove = { fromR, fromC, toR, toC };

    boardState[toR][toC] = boardState[fromR][fromC];
    boardState[fromR][fromC] = '';

    if (boardState[toR][toC] === 'wp' && toR === 0) {
        boardState[toR][toC] = 'wq';
    }

    createBoard();

    if (targetPiece === 'bk') {
        endGame("승리! 컴퓨터의 킹을 격파했습니다.");
        return;
    }

    turn = "black";
    turnEl.innerText = "COMPUTER (AI THINKING...)";
    turnEl.className = "black-turn";

    isAiThinking = true;
    setTimeout(makeAiMove, 400);
}

function makeAiMove() {
    if (!gameActive) return;

    let bestMove = null;
    let bestScore = -Infinity;
    
    let aiMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (boardState[r][c] && boardState[r][c][0] === 'b') {
                let moves = calculateMoves(r, c, boardState);
                moves.forEach(m => {
                    aiMoves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c });
                });
            }
        }
    }

    if (aiMoves.length === 0) {
        endGame("체크메이트 또는 스테일메이트! 대국이 끝났습니다.");
        return;
    }

    // AI 미니맥스 예측 분석 루프
    aiMoves.forEach(move => {
        let tempBoard = boardState.map(row => [...row]);
        let captured = tempBoard[move.toR][move.toC];
        tempBoard[move.toR][move.toC] = tempBoard[move.fromR][move.fromC];
        tempBoard[move.fromR][move.fromC] = '';
        
        let currentGain = 0;
        if (captured && captured[0] === 'w') {
            currentGain = PIECE_VALUES[captured[1]];
        }

        let maxUserCounterScore = 0;
        for (let ur = 0; ur < 8; ur++) {
            for (let uc = 0; uc < 8; uc++) {
                if (tempBoard[ur][uc] && tempBoard[ur][uc][0] === 'w') {
                    let userMoves = calculateMoves(ur, uc, tempBoard);
                    userMoves.forEach(um => {
                        let target = tempBoard[um.r][um.c];
                        if (target && target[0] === 'b') {
                            let value = PIECE_VALUES[target[1]];
                            if (value > maxUserCounterScore) {
                                maxUserCounterScore = value;
                            }
                        }
                    });
                }
            }
        }

        let totalEvaluation = currentGain - maxUserCounterScore;

        if (move.toR >= 3 && move.toR <= 4 && move.toC >= 3 && move.toC <= 4) {
            totalEvaluation += 2; 
        }

        if (totalEvaluation > bestScore) {
            bestScore = totalEvaluation;
            bestMove = move;
        }
    });

    if (!bestMove || bestScore === -Infinity) {
        bestMove = aiMoves[Math.floor(Math.random() * aiMoves.length)];
    }

    const targetPiece = boardState[bestMove.toR][bestMove.toC];

    // 컴퓨터가 내 기물을 가져갔다면 수집소에 적재
    if (targetPiece && targetPiece[0] === 'w') {
        capturedByBlack.push(targetPiece[1]);
    }

    // 컴퓨터의 마지막 이동 좌표 업데이트
    lastMove = { fromR: bestMove.fromR, fromC: bestMove.fromC, toR: bestMove.toR, toC: bestMove.toC };

    boardState[bestMove.toR][bestMove.toC] = boardState[bestMove.fromR][bestMove.fromC];
    boardState[bestMove.fromR][bestMove.fromC] = '';

    if (boardState[bestMove.toR][bestMove.toC] === 'bp' && bestMove.toR === 7) {
        boardState[bestMove.toR][bestMove.toC] = 'bq';
    }

    createBoard();

    if (targetPiece === 'wk') {
        endGame("패배! 당신의 킹이 컴퓨터 AI에게 정복당했습니다.");
        return;
    }

    turn = "white";
    isAiThinking = false;
    turnEl.innerText = "WHITE (YOU)";
    turnEl.className = "white-turn";
}

function endGame(message) {
    gameActive = false;
    setTimeout(() => {
        alert(message);
    }, 100);
}

function calculateMoves(r, c, state) {
    let moves = [];
    const piece = state[r][c];
    if (!piece) return moves;

    const color = piece[0];
    const type = piece[1];

    const addStraightMoves = () => {
        const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
        dirs.forEach(d => {
            let nr = r + d[0], nc = c + d[1];
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (state[nr][nc] === '') {
                    moves.push({ r: nr, c: nc });
                } else {
                    if (state[nr][nc][0] !== color) moves.push({ r: nr, c: nc });
                    break;
                }
                nr += d[0]; nc += d[1];
            }
        });
    };

    const addDiagonalMoves = () => {
        const dirs = [[-1,-1], [-1,1], [1,-1], [1,1]];
        dirs.forEach(d => {
            let nr = r + d[0], nc = c + d[1];
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (state[nr][nc] === '') {
                    moves.push({ r: nr, c: nc });
                } else {
                    if (state[nr][nc][0] !== color) moves.push({ r: nr, c: nc });
                    break;
                }
                nr += d[0]; nc += d[1];
            }
        });
    };

    switch (type) {
        case 'p': 
            const dir = color === 'w' ? -1 : 1;
            if (r + dir >= 0 && r + dir < 8 && state[r + dir][c] === '') {
                moves.push({ r: r + dir, c });
                const startRow = color === 'w' ? 6 : 1;
                if (r === startRow && state[r + dir * 2][c] === '') {
                    moves.push({ r: r + dir * 2, c });
                }
            }
            [c - 1, c + 1].forEach(ac => {
                if (ac >= 0 && ac < 8 && r + dir >= 0 && r + dir < 8) {
                    const target = state[r + dir][ac];
                    if (target && target[0] !== color) moves.push({ r: r + dir, c: ac });
                }
            });
            break;

        case 'r': addStraightMoves(); break;
        case 'b': addDiagonalMoves(); break;
        case 'q': addStraightMoves(); addDiagonalMoves(); break;

        case 'k': 
            const kDirs = [[-1,0], [1,0], [0,-1], [0,1], [-1,-1], [-1,1], [1,-1], [1,1]];
            kDirs.forEach(d => {
                let nr = r + d[0], nc = c + d[1];
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    if (state[nr][nc] === '' || state[nr][nc][0] !== color) moves.push({ r: nr, c: nc });
                }
            });
            break;

        case 'n': 
            const nMoves = [
                [-2,-1], [-2,1], [-1,-2], [-1,2],
                [1,-2], [1,2], [2,-1], [2,1]
            ];
            nMoves.forEach(m => {
                let nr = r + m[0], nc = c + m[1];
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    if (state[nr][nc] === '' || state[nr][nc][0] !== color) moves.push({ r: nr, c: nc });
                }
            });
            break;
    }
    return moves;
}

function showSuggestions() {
    possibleMoves.forEach(move => {
        const tile = boardEl.querySelector(`[data-row='${move.r}'][data-col='${move.c}']`);
        if (tile) tile.classList.add("suggested");
    });
}

function clearHighlights() {
    const tiles = boardEl.querySelectorAll(".tile");
    tiles.forEach(t => {
        t.classList.remove("selected");
        t.classList.remove("suggested");
    });
}

function resetGame() {
    turn = "white";
    gameActive = true;
    turnEl.innerText = "WHITE (YOU)";
    turnEl.className = "white-turn";
    selectedTile = null;
    possibleMoves = [];
    isAiThinking = false;
    lastMove = null; // 리셋 시 경로 초기화
    capturedByBlack = []; // 리셋 시 창고 폐기
    capturedByWhite = [];
    boardState = [
        ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
        ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
        ['',   '',   '',   '',   '',   '',   '',   ''],
        ['',   '',   '',   '',   '',   '',   '',   ''],
        ['',   '',   '',   '',   '',   '',   '',   ''],
        ['',   '',   '',   '',   '',   '',   '',   ''],
        ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
        ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
    ];
    createBoard();
}

createBoard();
