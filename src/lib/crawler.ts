// 네이버 홈피드 크롤러 서비스
export interface FeedItem {
  title: string
  url: string
  service: string
}

export interface CrawlProgress {
  currentPage: number
  totalPages: number
  itemsFound: number
  status: 'running' | 'completed' | 'error'
  message?: string
}

interface ApiResponse {
  cards?: Array<{
    code?: string
    contents?: {
      item?: {
        title?: string
        url?: string
      }
      byPass?: {
        service?: string
      }
    }
  }>
  pageInfo?: {
    nextCursor?: string
    adAfterCardsCount?: number
    adNextSeq?: number
  }
}

export class NaverFeedCrawler {
  private readonly SESSION_ID = "spGLaNSR5qMlh35F"
  private readonly MAX_PAGES = 15
  private readonly DELAY = 1500 // 1.5초
  private readonly MAX_RETRIES = 3 // 최대 재시도 횟수

  async fetchPage(
    page: number,
    nextCursor?: string,
    adAfterCardsCount?: number,
    adNextSeq?: number,
    retryCount = 0
  ): Promise<ApiResponse> {
    const baseUrl = "https://m.naver.com/nvhaproxy_craft/v1/homefeed/mainHomefeed/1/feeds"
    
    const params = new URLSearchParams({
      sessionId: this.SESSION_ID,
      page: page.toString(),
    })

    if (nextCursor) params.append("nextCursor", nextCursor)
    if (adAfterCardsCount) params.append("adAfterCardsCount", adAfterCardsCount.toString())
    if (adNextSeq) params.append("adNextSeq", adNextSeq.toString())

    const headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      "Referer": "https://m.naver.com/",
    }

    try {
      // 타임아웃 설정을 위한 AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃

      const response = await fetch(`${baseUrl}?${params}`, { 
        headers,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId) // 성공시 타임아웃 클리어
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data

    } catch (error) {
      console.error(`페이지 ${page} 요청 실패 (시도 ${retryCount + 1}):`, error)
      
      // 재시도 로직
      if (retryCount < this.MAX_RETRIES) {
        const delayTime = Math.pow(2, retryCount) * 1000 // 지수 백오프
        console.log(`${delayTime}ms 후 재시도...`)
        await new Promise(resolve => setTimeout(resolve, delayTime))
        return this.fetchPage(page, nextCursor, adAfterCardsCount, adNextSeq, retryCount + 1)
      }
      
      throw new Error(`페이지 ${page} 요청 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  extractItemsFromPage(data: ApiResponse): FeedItem[] {
    try {
      const items: FeedItem[] = []
      const cards = data?.cards || []

      if (!Array.isArray(cards)) {
        console.warn('응답 데이터에 유효한 cards 배열이 없습니다.')
        return []
      }

      for (const card of cards) {
        try {
          // 'searchFeed' 코드가 붙은 카드만 처리
          if (card?.code !== "searchFeed") continue

          const contents = card?.contents
          const item = contents?.item
          const bypass = contents?.byPass

          if (!item || !bypass) continue

          const title = item?.title
          const url = item?.url
          let service = bypass?.service

          if (!title || !url || !service) continue

          // 제목과 URL 정리
          const cleanTitle = String(title).trim()
          const cleanUrl = String(url).trim()

          if (!cleanTitle || !cleanUrl) continue

          // 인플루언서 콘텐츠 식별
          if (/^https:\/\/in\.naver\.com\/[^/]+\/contents\/internal\/\d+/.test(cleanUrl)) {
            service = "INFL"
          }

          items.push({ 
            title: cleanTitle, 
            url: cleanUrl, 
            service: String(service) 
          })

        } catch (itemError) {
          console.warn('카드 처리 중 오류:', itemError)
          // 개별 카드 오류는 무시하고 계속 진행
          continue
        }
      }

      return items

    } catch (error) {
      console.error('데이터 추출 중 오류:', error)
      return []
    }
  }

  async* crawlAll(
    onProgress?: (progress: CrawlProgress) => void
  ): AsyncGenerator<FeedItem[], void, unknown> {
    const allResults: FeedItem[] = []
    const seenUrls = new Set<string>()
    let nextCursor: string | undefined
    let adAfterCardsCount: number | undefined
    let adNextSeq: number | undefined
    let consecutiveEmptyPages = 0
    const MAX_EMPTY_PAGES = 3

    try {
      for (let page = 1; page <= this.MAX_PAGES; page++) {
        // 진행 상황 업데이트
        onProgress?.({
          currentPage: page,
          totalPages: this.MAX_PAGES,
          itemsFound: allResults.length,
          status: 'running',
          message: `페이지 ${page} 처리 중...`
        })

        try {
          const data = await this.fetchPage(page, nextCursor, adAfterCardsCount, adNextSeq)

          // 다음 페이지 파라미터 업데이트
          const pageInfo = data?.pageInfo
          nextCursor = pageInfo?.nextCursor
          adAfterCardsCount = pageInfo?.adAfterCardsCount
          adNextSeq = pageInfo?.adNextSeq

          const pageItems = this.extractItemsFromPage(data)

          // 연속으로 빈 페이지가 나오면 중단
          if (pageItems.length === 0) {
            consecutiveEmptyPages++
            console.log(`페이지 ${page}: 아이템 없음 (연속 ${consecutiveEmptyPages}번째)`)
            
            if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
              console.log(`연속 ${MAX_EMPTY_PAGES}개 빈 페이지로 인해 크롤링 종료`)
              break
            }
          } else {
            consecutiveEmptyPages = 0 // 아이템이 있으면 카운터 리셋
          }

          // 중복 제거
          const newItems: FeedItem[] = []
          for (const item of pageItems) {
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url)
              allResults.push(item)
              newItems.push(item)
            }
          }

          // 새로운 아이템들 반환
          if (newItems.length > 0) {
            console.log(`페이지 ${page}: ${newItems.length}개 새 아이템 발견`)
            yield newItems
          }

          // 지연 (마지막 페이지가 아닐 때만)
          if (page < this.MAX_PAGES) {
            await new Promise(resolve => setTimeout(resolve, this.DELAY))
          }

        } catch (pageError) {
          console.error(`페이지 ${page} 처리 실패:`, pageError)
          
          // 페이지별 오류는 경고만 하고 계속 진행
          onProgress?.({
            currentPage: page,
            totalPages: this.MAX_PAGES,
            itemsFound: allResults.length,
            status: 'running',
            message: `페이지 ${page} 처리 실패, 다음 페이지로 진행...`
          })
          
          // 연속 실패 카운트 증가
          consecutiveEmptyPages++
          if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
            throw new Error(`연속 ${MAX_EMPTY_PAGES}개 페이지 실패로 인해 크롤링 중단`)
          }
        }
      }

      onProgress?.({
        currentPage: this.MAX_PAGES,
        totalPages: this.MAX_PAGES,
        itemsFound: allResults.length,
        status: 'completed',
        message: `크롤링 완료: 총 ${allResults.length}개 아이템 수집`
      })

    } catch (error) {
      console.error('크롤링 중 치명적 오류:', error)
      onProgress?.({
        currentPage: 0,
        totalPages: this.MAX_PAGES,
        itemsFound: allResults.length,
        status: 'error',
        message: error instanceof Error ? error.message : '크롤링 중 알 수 없는 오류가 발생했습니다.'
      })
      throw error
    }
  }
} 