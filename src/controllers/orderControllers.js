import Order from '../../models/order'
import Member from '../../models/member'
import Restaurant from '../../models/restaurant'
import { account, oauth } from '../mailPassword.js'
import NodeMailer from 'nodemailer'
import { validationResult } from '../../node_modules/express-validator'

async function sendCompletedMail(email, orderId) {
  console.log(1, account)
  console.log(2, orderId)
  console.log(3, email)
  let transporter = NodeMailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: account.email,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
      refreshToken: oauth.refreshToken,
      accessToken: oauth.accessToken,
    },
  })

  transporter.sendMail(
    {
      from: account.email, // sender address
      to: email, // list of receivers
      subject: `Completed Mail`, // Subject line
      text: '美食家-訂購完成通知信', // plain text body
      html: `這是您的訂購完成通知信, <br> 您可以從這個連結查詢此筆訂單。 <a href='http://bookingsystemclient.herokuapp.com/orderdetails?order_ID=${orderId}'>查詢此筆訂單</a>`, // html body
    },
    (err, res) => {
      if (err) return console.log('send completed mail error', err)
      else console.log(JSON.stringify(res))
    }
  )
}

const createOrder = async (req, res, next) => {
  console.log('server createOrder is working!!!')
  try {
    const { date, timeString, adult, children, notes, restaurant_name, sessionStorageData } = req.body
    console.log('-------req.body', req.body, date, timeString)
    let dateTime = new Date(`${date} ${timeString}`)
    console.log('dateTime', dateTime)
    if (Object.keys(sessionStorageData).length > 0) {
      const member = await Member.findOne(
        {
          name: sessionStorageData.member,
        },
        {
          _id: 1,
          email: 1,
          token: 1,
          create_token_time: 1,
        }
      )
      console.log(888, !member.token, member.create_token_time)
      const limitTime = member.create_token_time !== null ? member.create_token_time.getTime() + 600000 : 0
      console.log('limitTime', limitTime, 'now', Date.now())
      if (!member.token || Date.now() > limitTime) {
        console.log('Not log in..')
        return res.status(403).json({ code: 403, message: 'Not log in' })
      }
      const restaurantID = await Restaurant.findOne(
        {
          name: restaurant_name,
        },
        {
          _id: 1,
        }
      )
      if (member && restaurantID) {
        const order = await Order.create({
          dateTime,
          adult,
          children,
          notes,
          restaurant_id: restaurantID._id,
          member_id: member._id,
          status: 'Confirmed',
        })
        console.log('order', order)
        await sendCompletedMail(member.email, order._id)
        res.status(200).json({
          code: 200,
          message: 'order is created',
        })
      } else {
        errObj(res, '500', 'memberID or restaurantID is null')
      }
    } else {
      return res.status(403).json({ code: 403, message: 'Not log in' })
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(422).json({
        code: 422,
        errors: errors.array(),
      })
      return
    }
  } catch (error) {
    return next(error)
  }
}

const findOrders = async (req, res, next) => {
  const { name } = req.query
  console.log('name', name)
  const today = new Date()
  if (name === 'undefined') {
    console.log('in undefined if!!!')
    res.status(403).json({
      code: 403,
      message: 'You are not log in',
    })
  } else {
    const member = await Member.findOne(
      { name: name },
      {
        _id: 1,
        email: 1,
        token: 1,
        create_token_time: 1,
      }
    )
    console.log('member', member)
    const limitTime = member.create_token_time !== null ? member.create_token_time.getTime() + 600000 : 0
    console.log('limitTime', limitTime)
    try {
      if (member.token && Date.now() < limitTime) {
        const memberID = await Member.findOne(
          {
            name: name,
          },
          {
            _id: 1,
          }
        )
        console.log('memberID', memberID)

        await Order.remove(
          {
            member_id: memberID._id,
            dateTime: { $lt: today },
          },
          (err, res) => {
            if (err) next(err)
            else {
              console.log('res', res)
            }
          }
        )

        const orders = await Order.find({
          member_id: memberID._id,
          dateTime: { $gt: today },
        }).sort({
          create_time: 1,
        })
        // console.log("orders controller", orders);
        res.status(200).json({ code: 200, orders })
      } else {
        console.log('Not log in...')
        res.status(403).json({
          code: 403,
          message: 'You are not log in',
        })
      }
    } catch (err) {
      return next(err)
    }
  }
}

const findOrderDetails = async (req, res, next) => {
  console.log(123456, 'findOrderDetails ???????')
  const { order_ID } = req.query
  console.log('find Order Details order_Id', order_ID)
  try {
    console.log('findOrderDetails try!')
    const memberID = await Order.findOne({ _id: order_ID }, { member_id: 1 })
    const member = await Member.findOne(
      { _id: memberID.member_id },
      { _id: 1, email: 1, token: 1, create_token_time: 1, name: 1 }
    )
    const limitTime = member.create_token_time !== null ? member.create_token_time.getTime() + 600000 : 0
    if (member.token && Date.now() < limitTime) {
      const orderDetails = await Order.findOne({
        member_id: memberID.member_id,
        _id: order_ID,
      })
      console.log('find Order Details', orderDetails)
      res.json({ code: 200, member: member.name, orderDetails })
    } else {
      console.log('else????', member.token && Date.now() < limitTime)
      console.log('Not log in...')
      res.status(403).json({
        code: 403,
        message: 'You are not log in',
      })
    }
  } catch (err) {
    console.log('catch ?????')
    return next(err)
  }
}

const modifiedOrderDetails = async (req, res, next) => {
  console.log('modified order details is working!!!')
  const { order_ID } = req.query
  try {
    const memberID = await Order.findOne({ _id: order_ID }, { member_id: 1 })
    const member = await Member.findOne(
      { _id: memberID.member_id },
      { _id: 1, email: 1, token: 1, create_token_time: 1 }
    )
    const limitTime = member.create_token_time !== null ? member.create_token_time.getTime() + 600000 : 0
    console.log(3902, 'member', member)
    if (member.token && Date.now() < limitTime) {
      console.log('你已經登入了!!!')
      const { adult, children, clickDate, timeString, notes } = req.body
      console.log('clickDate', clickDate)
      console.log('timeString', timeString)
      console.log(12345, `${clickDate} ${timeString}`)
      let dateTime = new Date(`${clickDate} ${timeString}`)
      console.log('dateTime', dateTime)
      const order = await Order.findOne({
        _id: order_ID,
      })
        .updateOne({
          adult,
          children,
          dateTime,
          notes,
          status: 'Confirmed',
          create_time: Date.now(),
          modified_time: Date.now(),
        })
        .then(() => {
          return Order.find({
            member_id: memberID.member_id,
          })
        })
      console.log('order', order)
      res.status(200).json({ code: 200, message: 'saved order detail change', order: order })
    } else {
      console.log('Not log in...')
      res.status(403).json({
        code: 403,
        message: 'You are not log in',
      })
    }
  } catch (err) {
    return next(err)
  }
}

const deleteOrderDetail = async (req, res, next) => {
  console.log('delete order detail controller is working!!!')
  const { order_ID } = req.query
  console.log('order_ID', order_ID)
  try {
    const memberID = await Order.findOne({ _id: order_ID }, { member_id: 1 })
    console.log(567, 'memberID', memberID)
    const member = await Member.findOne(
      { _id: memberID.member_id },
      { _id: 1, email: 1, token: 1, create_token_time: 1 }
    )
    console.log(567, 'member', member)
    const limitTime = member.create_token_time !== null ? member.create_token_time.getTime() + 600000 : 0
    console.log('limitTime', limitTime, 'now', Date.now())
    console.log(Date.now() < limitTime)
    if (member.token && Date.now() < limitTime) {
      const orderDetails = await Order.findOne(
        {
          _id: order_ID,
        },
        {
          _id: 1,
          dateTime: 1,
        }
      )
      const today = new Date().getTime()
      const deteleDeadline = orderDetails.dateTime.getTime() - 43200000 // 12小時前可取消訂單
      if (today > deteleDeadline) {
        console.log('You are overdue deadline')
        return res.status(400).json({
          code: 400,
          message: 'You are overdue deadline',
        })
      }

      const newOrders = await Order.deleteOne({
        _id: order_ID,
      }).then(() => {
        console.log('刪除完畢')
        return Order.find({
          member_id: member._id,
        })
      })
      res.status(200).json(newOrders)
    } else {
      console.log('Not log in')
      res.status(403).json({
        code: 403,
        message: 'You are not log in',
      })
    }
  } catch (err) {
    return next(err)
  }
}

const errObj = (res, code, message) => {
  res.status(code).json({
    err_code: code,
    message: message,
  })
}

module.exports = {
  createOrder,
  findOrders,
  findOrderDetails,
  modifiedOrderDetails,
  deleteOrderDetail,
}
