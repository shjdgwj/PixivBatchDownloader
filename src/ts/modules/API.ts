// api 类
// 不依赖其他模块，可独立使用
import {
  UserImageWorksWithTag,
  BookmarkData,
  UserProfile,
  UserProfileAllData,
  IllustData,
  UgoiraData,
  RecommendData,
  RankingData,
  RecommenderData,
  SearchData,
  NewIllustData,
  BookMarkNewData,
  UserNovelsWithTag,
  NovelData,
  NovelSeriesData,
  NovelSearchData,
} from './CrawlResult.d'

import {
  userWorksType,
  RankingOption,
  SearchOption,
  NewIllustOption,
  tagPageFlag,
} from './CrawlArgument.d'

import { IDData } from './Store.d'

class API {
  // 根据对象某个属性的值（视为数字）排序对象。返回的结果是降序排列
  static sortByProperty(propertyName: string) {
    return function (object1: any, object2: any) {
      // 排序的内容有时可能是字符串，需要转换成数字排序
      const value1 = parseInt(object1[propertyName])
      const value2 = parseInt(object2[propertyName])

      if (value2 < value1) {
        return -1
      } else if (value2 > value1) {
        return 1
      } else {
        return 0
      }
    }
  }

  // 检查给定的字符串解析为数字后，是否大于 0
  static checkNumberGreater0(arg: string) {
    let num = parseInt(arg)
    // 空值会是 NaN
    if (!isNaN(num) && num > 0) {
      // 符合条件
      return {
        result: true,
        value: num,
      }
    }
    // 不符合条件
    return {
      result: false,
      value: 0,
    }
  }

  // 从 url 中获取指定的查询字段的值
  // 注意：返回值经过 encodeURIComponent 编码！
  static getURLSearchField(url: string, query: string) {
    const result = new URL(url).searchParams.get(query)
    if (result !== null) {
      return encodeURIComponent(result)
    } else {
      return ''
    }
  }

  // 从 url 中获取 tag
  static getTagFromURL(url: string) {
    const nowURL = new URL(url)

    // 2 用户作品列表页
    if (/\/users\/\d+/.test(url) && !url.includes('/bookmarks')) {
      // 匹配 pathname 里用户 id 之后的字符
      const test = nowURL.pathname.match(/\/users\/\d+(\/.+)/)
      if (test && test.length === 2) {
        const str = test[1]
        // 如果用户 id 之后的字符多于一个路径，则把最后一个路径作为 tag，示例
        // https://www.pixiv.net/users/2188232/illustrations/ghostblade
        const array = str.split('/')
        // ["", "illustrations", "ghostblade"]
        if (array.length > 2) {
          return array[array.length - 1]
        }
      }
    }

    // 4 旧版收藏页面
    if (nowURL.pathname === '/bookmark.php') {
      if (parseInt(this.getURLSearchField(nowURL.href, 'untagged')) === 1) {
        // 旧版 “未分类” tag 是个特殊标记
        // https://www.pixiv.net/bookmark.php?untagged=1
        return '未分類'
      }
    }

    // 4 新版收藏页面
    if (nowURL.pathname.includes('/bookmarks/artworks')) {
      // 新版收藏页 url，tag 在路径末端，如
      // https://www.pixiv.net/users/9460149/bookmarks/artworks/R-18
      const test = /\/bookmarks\/artworks\/(.[^\/|^\?|^&]*)/.exec(
        nowURL.pathname
      )
      if (test !== null && test.length > 1 && !!test[1]) {
        return test[1]
      }
    }

    // 5 搜索页面
    if (nowURL.pathname.includes('/tags/')) {
      return nowURL.pathname.split('tags/')[1].split('/')[0]
    }

    // 默认情况，从查询字符串里获取，如下网址
    // https://www.pixiv.net/bookmark.php?tag=R-18
    return this.getURLSearchField(nowURL.href, 'tag')
  }

  // 更新 token
  static updateToken() {
    // 每隔一段时间更新 token，如果未达到指定时间间隔，则不检查
    const interval = 300000 // 两次检查之间的间隔。目前设置为 5 分钟
    const nowTime = new Date().getTime()
    const lastTimeStr = localStorage.getItem('xzTokenTime')
    if (lastTimeStr && nowTime - Number.parseInt(lastTimeStr) < interval) {
      return
    }

    // 从网页源码里获取用户 token，并储存起来
    fetch('https://www.pixiv.net/artworks/62751951')
      .then((response) => {
        return response.text()
      })
      .then((data) => {
        let result = data.match(/token":"(\w+)"/)
        if (result) {
          localStorage.setItem('xzToken', result[1])
          localStorage.setItem('xzTokenTime', new Date().getTime().toString())
        } else {
          console.warn('UpdateToken failed: no token found!')
        }
      })
  }

  // 获取 token
  // 从本地存储里获取用户 token
  static getToken() {
    let result = localStorage.getItem('xzToken')
    if (result) {
      return result
    } else {
      this.updateToken()
      return ''
    }
  }

  // 从 url 里获取 artworks id
  // 可以传入 url，无参数则使用当前页面的 url
  static getIllustId(url?: string) {
    const str = url || window.location.search || location.href
    if (str.includes('illust_id')) {
      // 传统 url
      return /illust_id=(\d*\d)/.exec(str)![1]
    } else if (str.includes('/artworks/')) {
      // 新版 url
      return /artworks\/(\d*\d)/.exec(str)![1]
    } else {
      // 直接取出 url 中的数字，不保证准确
      return /\d*\d/.exec(location.href)![0]
    }
  }

  // 从 url 里获取 novel id
  // https://www.pixiv.net/novel/show.php?id=12771688
  static getNovelId(url?: string) {
    const str = url || window.location.search || location.href
    const test = str.match(/\?id=(\d*)?/)
    return test![1]
  }

  // 通用的请求流程
  // 发送 get 请求，返回 json 数据，抛出异常
  static request<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'get',
        credentials: 'same-origin',
      })
        .then((response) => {
          if (response.ok) {
            return response.json()
          } else {
            // 第一种异常，请求成功但状态不对
            reject({
              status: response.status,
              statusText: response.statusText,
            })
          }
        })
        .then((data) => {
          resolve(data)
        })
        .catch((error) => {
          // 第二种异常，请求失败
          reject(error)
        })
    })
  }

  // 获取收藏数据
  // 这个 api 返回的作品列表顺序是按收藏顺序由近期到早期排列的
  static async getBookmarkData(
    id: string,
    tag: string,
    offset: number,
    hide: boolean = false
  ): Promise<BookmarkData> {
    const url = `https://www.pixiv.net/ajax/user/${id}/illusts/bookmarks?tag=${tag}&offset=${offset}&limit=100&rest=${
      hide ? 'hide' : 'show'
    }&rdm=${Math.random()}`

    return this.request(url)
  }

  // 添加收藏
  static async addBookmark(
    id: string,
    tags: string,
    token: string,
    hide: boolean
  ) {
    let restrict: 0 | 1
    if (!hide) {
      // 公开作品
      restrict = 0
    } else {
      // 非公开作品
      restrict = 1
    }

    return fetch('https://www.pixiv.net/rpc/index.php', {
      method: 'post',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      credentials: 'same-origin', // 附带 cookie
      body: `mode=save_illust_bookmark&illust_id=${id}&restrict=${restrict}&comment=&tags=${tags}&tt=${token}`,
    })
  }

  // 获取用户信息
  static getUserProfile(id: string): Promise<UserProfile> {
    // full=1 在画师的作品列表页使用，获取详细信息
    // full=0 在作品页内使用，只获取少量信息
    const url = `https://www.pixiv.net/ajax/user/${id}?full=1`
    return this.request(url)
  }

  // 获取用户指定类型的作品列表
  // 返回作品的 id 列表，不包含详细信息
  static async getUserWorksByType(
    id: string,
    type: userWorksType[] = ['illusts', 'manga', 'novels']
  ): Promise<IDData[]> {
    let typeSet = new Set(type)
    let result: IDData[] = []
    const url = `https://www.pixiv.net/ajax/user/${id}/profile/all`

    let data: UserProfileAllData = await this.request(url)
    for (const type of typeSet.values()) {
      const idList = Object.keys(data.body[type])
      for (const id of idList) {
        result.push({
          type,
          id,
        })
      }
    }

    return result
  }

  // 获取用户指定类型、并且指定 tag 的作品列表
  // 返回整个请求的结果，里面包含作品的详细信息
  // 必须带 tag 使用。不带 tag 虽然也能获得数据，但是获得的并不全，很奇怪。
  static getUserWorksByTypeWithTag(
    id: string,
    type: tagPageFlag,
    tag: string,
    offset: number = 0,
    limit: number = 999999
  ): Promise<UserImageWorksWithTag | UserNovelsWithTag> {
    // https://www.pixiv.net/ajax/user/2369321/illusts/tag?tag=Fate/GrandOrder&offset=0&limit=9999999
    const url = `https://www.pixiv.net/ajax/user/${id}/${type}/tag?tag=${tag}&offset=${offset}&limit=${limit}`
    return this.request(url)
  }

  // 获取插画 漫画 的详细信息
  static getImageWorksData(id: string): Promise<IllustData> {
    const url = `https://www.pixiv.net/ajax/illust/${id}`
    return this.request(url)
  }

  // 获取作品的动图信息
  static getUgoiraMeta(id: string): Promise<UgoiraData> {
    const url = `https://www.pixiv.net/ajax/illust/${id}/ugoira_meta`
    return this.request(url)
  }

  // 获取插小说的详细信息
  static getNovelWorksData(id: string): Promise<NovelData> {
    const url = `https://www.pixiv.net/ajax/novel/${id}`
    return this.request(url)
  }

  // 获取相关作品
  static getRelatedData(id: string): Promise<RecommendData> {
    // 最后的 18 是预加载首屏的多少个作品的信息，和下载并没有关系
    const url = `https://www.pixiv.net/ajax/illust/${id}/recommend/init?limit=18`
    return this.request(url)
  }

  // 获取排行榜数据
  // 排行榜数据基本是一批 50 条作品信息
  static getRankingData(option: RankingOption): Promise<RankingData> {
    let url = `https://www.pixiv.net/ranking.php?mode=${option.mode}&p=${option.p}&format=json`

    // 把可选项添加到 url 里
    let temp = new URL(url)

    // 下面两项需要判断有值再添加。不可以添加了这些字段却使用空值。
    if (option.worksType) {
      temp.searchParams.set('content', option.worksType)
    }
    if (option.date) {
      temp.searchParams.set('date', option.date)
    }

    url = temp.toString()

    return this.request(url)
  }

  // 获取收藏后的相似作品数据
  // 需要传入作品 id 和要抓取的数量。但是实际获取到的数量会比指定的数量少一些
  static getRecommenderData(
    id: string,
    number: number
  ): Promise<RecommenderData> {
    const url = `/rpc/recommender.php?type=illust&sample_illusts=${id}&num_recommendations=${number}`
    return this.request(url)
  }

  // 获取搜索数据
  static getSearchData(
    word: string,
    type: string = 'artworks',
    p: number = 1,
    option: SearchOption = {}
  ): Promise<SearchData> {
    // 基础的 url
    let url = `https://www.pixiv.net/ajax/search/${type}/${encodeURIComponent(
      word
    )}?word=${encodeURIComponent(word)}&p=${p}`

    // 把可选项添加到 url 里
    let temp = new URL(url)
    for (const [key, value] of Object.entries(option)) {
      if (value) {
        temp.searchParams.set(key, value)
      }
    }
    url = temp.toString()

    return this.request(url)
  }

  static getNovelSearchData(
    word: string,
    p: number = 1,
    option: SearchOption = {}
  ): Promise<NovelSearchData> {
    // 基础的 url
    let url = `https://www.pixiv.net/ajax/search/novels/${encodeURIComponent(
      word
    )}?word=${encodeURIComponent(word)}&p=${p}`

    // 把可选项添加到 url 里
    let temp = new URL(url)
    for (const [key, value] of Object.entries(option)) {
      if (value) {
        temp.searchParams.set(key, value)
      }
    }
    url = temp.toString()

    return this.request(url)
  }

  // 获取大家的新作品的数据
  static getNewIllustData(option: NewIllustOption): Promise<NewIllustData> {
    let url = `https://www.pixiv.net/ajax/illust/new?lastId=${option.lastId}&limit=${option.limit}&type=${option.type}&r18=${option.r18}`
    return this.request(url)
  }

  // 获取关注的的新作品的数据
  static getBookmarkNewIllustData(
    p = 1,
    r18 = false
  ): Promise<BookMarkNewData[]> {
    let path = r18 ? 'bookmark_new_illust_r18' : 'bookmark_new_illust'

    let url = `https://www.pixiv.net/${path}.php?p=${p}`

    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'get',
        credentials: 'same-origin',
      })
        .then((response) => {
          if (response.ok) {
            return response.text()
          } else {
            throw new Error(response.status.toString())
          }
        })
        .then((data) => {
          let listPageDocument = new (window as any).DOMParser().parseFromString(
            data,
            'text/html'
          )

          let worksInfoText = listPageDocument.querySelector(
            '#js-mount-point-latest-following'
          ).dataset.items

          resolve(JSON.parse(worksInfoText))
        })
        .catch((error) => {
          reject(error)
        })
    })
  }

  // 根据 illustType，返回作品类型的描述
  // 主要用于储存进 idList
  static getWorkType(
    illustType: 0 | 1 | 2 | 3 | '0' | '1' | '2' | '3'
  ): 'illusts' | 'manga' | 'ugoira' | 'novels' | 'unkown' {
    switch (parseInt(illustType.toString())) {
      case 0:
        return 'illusts'
      case 1:
        return 'manga'
      case 2:
        return 'ugoira'
      case 3:
        return 'novels'
      default:
        return 'unkown'
    }
  }

  // 从 URL 中获取指定路径名的值，适用于符合 RESTful API 风格的路径
  // 如 https://www.pixiv.net/novel/series/1090654
  // 把路径用 / 分割，查找 key 所在的位置，后面一项就是它的 value
  static getURLPathField(query: string) {
    const pathArr = location.pathname.split('/')
    const index = pathArr.indexOf(query)
    if (index > 0) {
      return pathArr[index + 1]
    }

    throw new Error(`getURLPathField ${query} failed!`)
  }

  // 获取小说的系列作品信息
  // 这个 api 目前一批最多只能返回 30 个作品的数据，所以可能需要多次获取
  static getNovelSeriesData(
    series_id: number | string,
    limit: number = 30,
    last_order: number,
    order_by = 'asc'
  ): Promise<NovelSeriesData> {
    const url = `https://www.pixiv.net/ajax/novel/series_content/${series_id}?limit=${limit}&last_order=${last_order}&order_by=${order_by}`
    return this.request(url)
  }
}

export { API }
