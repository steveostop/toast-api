const azureDb = require('./db/microsExportsDb');
const TransSummary = azureDb.model('TransSummary');
const LaborSummary = azureDb.model('LaborSummary');
const ToastAPI = require('./ToastAPI');

const toastApi = new ToastAPI(process.env.TOAST_CLIENTID, process.env.TOAST_CLIENTSECRET);

const getMappings = async (storeGUID) => {
    const revenueCenters = await toastApi.getAllRevenueCenters(storeGUID).catch(console.error);
    const tables = await toastApi.getAllTables(storeGUID).catch(console.error);
    const diningOptions = await toastApi.getAllDiningOptions(storeGUID).catch(console.error);
    const voidReasons = await toastApi.getAllVoidReasons(storeGUID).catch(console.error);
    const maps =  {
        revenueCenters: revenueCenters,
        tables: tables,
        diningOptions: diningOptions,
        voidReasons: voidReasons
    }
    return maps;
}

const processOrders = async (dateString, location, toast = toastApi) => {
    const { store, toastGuid } = location
    const bizDay = new Date(dateString);
    const orders = await toast.getAllOrders(toastGuid, bizDay).catch(console.error);
    const maps = await getMappings(toastGuid).catch(console.error);
    if (!orders || !maps) return;
    
    //fs.writeFileSync(`orders-${bday.toISOString()}.json`, JSON.stringify(orders));
    const summaryId = `${store}-${dateString}-T`
    const tSumm = { // transSummary
        _id: summaryId,
        location: store,
        businessDay: bizDay.toISOString().substring(0,10),
        dataSource: 'toast',
        revenueCenters: [],
        checks: [],
        serviceCharges: [],
        orderTypes: [],
        tables: [],
        employees: [],
        voids: [],
        discounts: [],
        majorGroups: [],
        familyGroups: [],
        tenderMedia: [],
        menuItems: []
    };
    
    const totals = {
        revenueCenters: {},
        checks: {},
        serviceCharges: {},
        orderTypes: {},
        tables: {},
        employees: {},
        voids: {},
        discounts: {},
        majorGroups: {},
        familyGroups: {},
        tenderMedia: {},
        menuItems: {}
    };
    const metrics =  {
        netSales: 0,
        grossSales: 0,
        taxes: 0,
        discounts: 0,
        refunds: 0,
        tips: 0,
        checkCount: 0,
        voidedCheckCount: 0,
        orderCount: 0,
        voidedOrderCount: 0,
        orderSourceCounts: {}
    };
    
    // process through orders
    for (let i = 0; i < orders.length; i++) {
        const ord = orders[i];
        if (ord.createdInTestMode) continue;
        if (ord.deleted) continue;

        // metrics
        metrics.orderCount++;
        if (ord.voided) metrics.voidedOrderCount++;
        if (!metrics.orderSourceCounts[ord.source]) metrics.orderSourceCounts[ord.source] = 0;
        metrics.orderSourceCounts[ord.source]++;
        
        // revenue centers
        const rcGuid = ord.revenueCenter?.guid || '<norvc>';
        if (!totals.revenueCenters[rcGuid]) totals.revenueCenters[rcGuid] = {
            _id: `${rcGuid}-${summaryId}`,
            sequence: rcGuid,
            name: maps.revenueCenters[rcGuid]?.name || '<noname>',
            count: 0,
            total: 0,
            otherData: {
                discountTotal: 0,
                tenderTotal: 0,
                serviceChargeTotal: 0
            }
        };
        if (rcGuid) totals.revenueCenters[rcGuid].count++;

        // process through checks
        for (let j = 0; j < ord.checks.length; j++) {
            const chk = ord.checks[j];
            if (chk.deleted) continue;

            // metrics
            metrics.netSales += (chk.amount * 10000);
            metrics.grossSales += (chk.totalAmount * 10000);
            metrics.taxes += (chk.taxAmount * 10000);
            metrics.discounts += ((chk?.totalDiscountAmount || 0) * 10000);
            metrics.checkCount++;
            if (chk.voided) metrics.voidedCheckCount++;


            // revenue centers
            if (rcGuid) totals.revenueCenters[rcGuid].total += (chk.amount * 10000);

            // checks
            totals.checks[chk.guid] = {
                _id: `${chk.guid}-${summaryId}`,
                sequence: chk.guid,
                number: metrics.checkCount,
                name: chk.displayNumber,
                total: chk.totalAmount * 10000,
                otherData: {
                    openTime: chk.openedDate,
                    closeTime: chk.closedDate,
                    coverCount: ord.numberOfGuests,
                    orderTypeSeq: ord.diningOption?.guid,
                    orderTypeName: maps.diningOptions[ord.diningOption?.guid]?.name,
                    revenueCenterSeq: rcGuid,
                    revenueCenterName: maps.revenueCenters[rcGuid]?.name,
                    subtotal: chk.amount,
                    serviceChargeTotal: 0,
                    taxTotal: chk.taxAmount,
                    paymentTotal: 0,
                    tableGuid: ord.table?.guid,
                    tableName: maps.tables[ord.table?.guid]?.name,
                    employeeCheckName: null,
                    employeeSeq: null,
                    voids: [],
                    discounts: [],
                    menuItems: [],
                    serviceCharges: [],
                    tenders: [], 
                    refunds: []
                }
            };


            // process through check payments 
            for (let k = 0; k < chk.payments.length; k++) {
                const pmt = chk.payments[k];
                
                // metrics
                metrics.tips += (pmt.tipAmount * 10000)
                metrics.refunds += ((pmt.refund?.refundAmount || 0) * 10000)

                // revenue centers
                if (rcGuid) totals.revenueCenters[rcGuid].total -= ((pmt.refund?.refundAmount || 0) * 10000);
                if (rcGuid) totals.revenueCenters[rcGuid].otherData.tenderTotal += (pmt.amount * 10000);

                // checks
                totals.checks[chk.guid].otherData.tenders.push({
                    amount: pmt.amount,
                    amountTendered: pmt.amountTendered,
                    type: pmt.type,
                    name: pmt.type,
                    chargeTip: pmt.tipAmount
                });
                if (pmt.voidInfo) totals.checks[chk.guid].otherData.voids.push({
                    amount: pmt.amount,
                    amountTendered: pmt.amountTendered,
                    approver: pmt.voidInfo.voidApprover.guid,
                    user: pmt.voidInfo.voidUser.guid,
                    date: pmt.voidInfo.voidDate
                });
                if (pmt.refund) totals.checks[chk.guid].otherData.refunds.push({
                    amount: pmt.refund.refundAmount,
                    date: pmt.refund.refundDate,
                    tipAmount: pmt.refund.tipRefundAmount
                });
            }

            // process through service charges per check
            for (let k = 0; k < chk.appliedServiceCharges.length; k++) {
                const sc = chk.appliedServiceCharges[k];
                
                // revenue centers
                if (rcGuid) totals.revenueCenters[rcGuid].otherData.serviceChargeTotal += (sc.chargeAmount * 10000);

                // checks
                totals.checks[chk.guid].otherData.serviceCharges.push({
                    taxAmount: sc.appliedTaxes?.taxAmount,
                    svcAmount: sc.chargeAmount,
                    svcPercentage: sc.percent,
                    type: sc.chargeType,
                    name: sc.name,
                    isDelivery: sc.selivery,
                    isDineIn: sc.dineIn,
                    isGratuity: sc.gratuity,
                    isTakeout: sc.takeout,
                    isTaxable: sc.taxable,
                    isRefunded: sc.refundDetails ? true : false,
                    refundAmount: sc.refundDetails?.refundAmount,
                    calcMethod: sc.serviceChargeCalculation,
                    category: sc.serviceChargeCategory
                })
                totals.checks[chk.guid].otherData.serviceChargeTotal += (sc.chargeAmount * 10000);

                // service charges
                if (!totals.serviceCharges[sc.serviceCharge.guid]) totals.serviceCharges[sc.serviceCharge.guid] = {
                    _id: `${sc.guid}-${summaryId}`,
                    sequence: sc.guid,
                    name: sc.name,
                    total: 0,
                    count: 0,
                    otherData: {
                        taxAmount: 0,
                        svcPercentage: sc.percent,
                        type: sc.chargeType,
                        isDelivery: sc.selivery,
                        isDineIn: sc.dineIn,
                        isGratuity: sc.gratuity,
                        isTakeout: sc.takeout,
                        isTaxable: sc.taxable,
                        calcMethod: sc.serviceChargeCalculation,
                        category: sc.serviceChargeCategory
                    }
                }
                totals.serviceCharges[sc.serviceCharge.guid].count++;
                totals.serviceCharges[sc.serviceCharge.guid].total += ((sc.chargeAmount || 0) * 10000);
                
                // process through service charge taxes
                for (let l = 0; l < sc.appliedTaxes.length; l++) {
                    const tax = sc.appliedTaxes[l];
                    // service charges
                    totals.serviceCharges[sc.serviceCharge.guid].otherData.taxAmount += ((tax.taxAmount || 0) * 10000);
                }

            }            
            
            // process through items (selections)
            for (let k = 0; k < chk.selections.length; k++) {
                const sel = chk.selections[k];
                
                // checks
                totals.checks[chk.guid].otherData.menuItems.push({
                    name: sel.displayName,
                    guid: sel.item?.guid,
                    modifiers: sel.modifiers,
                    amout: sel.price,
                    qty: sel.quantity,
                    isRefunded: sel.refundDetails ? true : false,
                    refundAmount: sel.refundDetails?.refundAmount,
                    isVoided: sel.voided,
                    voidReason: maps.voidReasons[sel.voidReason?.guid]?.name
                });

                // order types (dining options)  #### NEEDS SORTED OUT
                const dOpt = maps.diningOptions[sel.diningOption?.guid];
                if (dOpt && !totals.orderTypes[dOpt.guid]) totals.orderTypes[dOpt.guid] = {
                    _id: `${dOpt.guid}-${summaryId}`,
                    sequence: dOpt.guid,
                    name: dOpt.name,
                    total: 0,
                    count: 0
                };
                if (dOpt) {
                    totals.orderTypes[dOpt.guid].count++;
                    totals.orderTypes[dOpt.guid].total += (sel.price * 10000);
                }

            }
        }
        
    }

    // move totals into summary
    for (const category in totals) {
        for (const key in totals[category]) {
            const obj = totals[category][key];
            
            obj.total /= 10000;
            if (obj.otherData?.discountTotal) obj.otherData.discountTotal /= 10000;
            if (obj.otherData?.tenderTotal) obj.otherData.tenderTotal /= 10000;
            if (obj.otherData?.serviceChargeTotal) obj.otherData.serviceChargeTotal /= 10000;
            if (obj.otherData?.taxAmount) obj.otherData.taxAmount /= 10000;

            tSumm[category].push(obj);
        }
    }
    metrics.netSales /= 10000;
    metrics.grossSales /= 10000;
    metrics.taxes /= 10000;
    metrics.discounts /= 10000;
    metrics.tips /= 10000;
    metrics.refunds /= 10000;
    tSumm.metrics = metrics;

    //console.log(dateString, locNum, metrics, summaryId);
    console.log(tSumm._id, '-', orders.length, 'orders, ', metrics.netSales, ' net sales');

    return Promise.allSettled([
        TransSummary.findOneAndUpdate(
            { _id: summaryId },
            tSumm, 
            { upsert: true }
        )
    ]);
}

/**
 * Pull and process toast time entries (time clock data)
 * The past 14 days are processed to capture labor edits
 * @param {String} dateString - 'YYYY-MM-DD' reprenstation of the buisness date.
 * @param {Object} location - Location object.
 * @param {String} location.store - Location's 3 character store number.
 * @param {String} location.toastGuid - Location's Toast assigned GUID.
 * @param {String} location.timezone - Location's timezone in IANA format
 * @param {Array} location.tippedJobs - Array of job codes of tipped posistions
 * @param {Object} location.wageInfo - Wage information object
 * @param {Number} location.wageInfo.minWage - Location's minimum wage
 * @param {Number} location.wageInfo.tippedMin - Locations minimum wage for tipped employees
 */
const processTimeEntries = async (dateString, location, weekStart = 3, toast = toastApi) => {
    const { store, toastGuid, timezone, tippedJobs, wageInfo } = location;
    if (!toastGuid) throw new Error(`No Toast GUID present for store ${store}!`);
    if (location.weekStart) weekStart = location.weekStart;
    
    const tippedJobsObj = {};
    for (let i = 0; i < tippedJobs.length; i++) tippedJobsObj[tippedJobs[i]] = true;
    
    // date range to process, start date is 2 week starts ago
    const endDate = new Date(dateString);
    const startDate = new Date(dateString);
    let startsAgo = 0;
    do {
        startDate.setUTCDate(startDate.getUTCDate() - 1);
        if (startDate.getUTCDay() === weekStart) startsAgo++;
    } while (startsAgo < 2)
    
    // dates and obj to track weekly hours/pay
    const currDate = new Date(startDate);
    let currWeek = new Date(startDate);
    const laborHours = {};
    laborHours[currWeek] = {};

    // array to store DB saves
    const dbSaves = [];

    do {
        const shiftGuids = {};
        const employeeGuids = {};
        const jobGuids = {};
        const currDateString = currDate.toISOString().substring(0,10);
        // start the labor summary object
        const laborSummary = {
            _id: `${store}-${currDateString}-T`,
            regularPay: 0,
            overtimePay: 0,
            regularHours: 0,
            overtimeHours: 0,
            regularRawHours: 0,
            overtimeRawHours: 0,
            timezone: timezone,
            businessDay: new Date(currDate),
            location: store,
            timeCards: [],
            dataSource: 'toast'
        };

        const timeCardsObj = {};
        // get and process time entries
        for await (const entries of toast.getTimeEntries(toastGuid, currDate)) {
            for (let i = 0; i < entries.length; i++) {
                const timeEntry = entries[i];
                if (timeEntry.deleted) continue; // skip deleted time entries
                const empGuid = timeEntry.employeeReference.guid;
                const shortEmpGuid = Buffer.from(timeEntry.employeeReference.guid.replace(/-/g, ''), 'hex').toString('base64').substring(0,22);
                const tcId = `${store}-${currDateString}-T-${timeEntry.employeeReference.guid}`;
                const bizDate = timeEntry.businessDate;
                const currHours = (timeEntry.regularHours * 10000) + (timeEntry.overtimeHours * 10000);
                let currRegHours = currHours;
                let currOtHours = 0;

                // track guids for employee, shift, and job API calls
                if (timeEntry.shiftReference) shiftGuids[timeEntry.shiftReference.guid] = true;
                employeeGuids[timeEntry.employeeReference.guid] = true;
                jobGuids[timeEntry.jobReference.guid] = true;
                
                // first store timecards in master object
                if (!timeCardsObj[empGuid]) timeCardsObj[empGuid] = {
                    _id: tcId,
                    employeeFirstName: '',
                    employeeLastName: '',
                    employeeSequence: timeEntry.employeeReference.guid,
                    employeeNumber: '',
                    employeePunches: []
                }

                // obj to store weekly hours * 10000
                if (!laborHours[currWeek][empGuid]) laborHours[currWeek][empGuid] = {
                    totalHours: 0,
                    regularHours: 0,
                    overtimeHours: 0,
                    regularHoursDaily: 0,
                    overtimeHoursDaily: 0,
                    accumulativeDays: 0,
                    lastDay: new Date(currDate),
                    consecutiveDays: 1,
                    accumlativeDeclaredTips: 0,
                    accumlativeChargedTips: 0
                };
                
                // hours - regular & OT calc
                laborHours[currWeek][empGuid].totalHours += currHours;
                laborHours[currWeek][empGuid].regularHours += currHours;
                if (laborHours[currWeek][empGuid].regularHours > (40 * 10000)) {
                    currOtHours = laborHours[currWeek][empGuid].regularHours - (40 * 10000);
                    currRegHours -= currOtHours;
                    laborHours[currWeek][empGuid].regularHours = (40 * 10000);
                    laborHours[currWeek][empGuid].overtimeHours += currOtHours;
                }

                // days - accumulative & consecutive
                laborHours[currWeek][empGuid].accumulativeDays++;
                const timeDiff = currDate - laborHours[currWeek][empGuid].lastDay;
                if (timeDiff >= (24 * 60 * 60 * 1000)) {
                    // not same day
                    laborHours[currWeek][empGuid].regularHoursDaily = currRegHours;  
                    laborHours[currWeek][empGuid].overtimeHoursDaily = currOtHours;
                    laborHours[currWeek][empGuid].consecutiveDays++;
                    laborHours[currWeek][empGuid].lastDay = new Date(currDate);
                    if (timeDiff > (24 * 60 * 60 * 1000)) {
                        // beyond tomorrow
                        laborHours[currWeek][empGuid].consecutiveDays = 1;
                    }
                } else { 
                    // same day punch
                    laborHours[currWeek][empGuid].regularHoursDaily += currRegHours;  
                    laborHours[currWeek][empGuid].overtimeHoursDaily += currOtHours;
                }

                // console.log(
                //     Math.round(laborHours[currWeek][empGuid].regularHours / 100) / 100, 
                //     Math.round(laborHours[currWeek][empGuid].regularHoursDaily / 100) / 100
                // );

                // accumlative tips
                laborHours[currWeek][empGuid].accumlativeDeclaredTips += (timeEntry.declaredCashTips * 10000)
                laborHours[currWeek][empGuid].accumlativeChargedTips += (timeEntry.nonCashTips * 10000)

                const grossFbSales = (timeEntry.nonCashSales ?? 0 * 10000) + (timeEntry.cashSales ?? 0 * 10000);
                const employeeServiceTips = (timeEntry.nonCashGratuityServiceCharges ?? 0 * 10000) + (timeEntry.cashGratuityServiceCharges ?? 0 * 10000);
                const shortTimeEntryGuid = Buffer.from(timeEntry.guid.replace(/-/g, ''), 'hex').toString('base64').substring(0,22);
                const punch = {
                    _id: `${tcId}-${shortTimeEntryGuid}`,
                    sequence: timeEntry.guid,
                    laborDate: new Date(`${bizDate.slice(0,4)}-${bizDate.slice(4,6)}-${bizDate.slice(6,8)}`),
                    clockInTime: new Date(timeEntry.inDate),
                    clockOutTime: new Date(timeEntry.outDate),
                    job: null,
                    jobSequence: timeEntry.jobReference.guid,
                    jobNumber: null,
                    regularHours: Math.round(currRegHours / 100) / 100,
                    regularPay: null,
                    overtimeHours: Math.round(currOtHours  / 100)/ 100,
                    overtimePay: null,
                    accumulativeRegularHours: Math.round(laborHours[currWeek][empGuid].regularHours / 100) / 100,
                    accumulativeOvertimeHours: Math.round(laborHours[currWeek][empGuid].overtimeHours / 100) / 100,
                    accumulativeDailyRegularHours: Math.round(laborHours[currWeek][empGuid].regularHoursDaily / 100) / 100,
                    accumulativeDailyOvertimeHours: Math.round(laborHours[currWeek][empGuid].overtimeHoursDaily / 100) / 100,
                    accumulativeDays: laborHours[currWeek][empGuid].accumulativeDays,
                    consecutiveDays: laborHours[currWeek][empGuid].consecutiveDays,
                    accumlativeDeclaredTips: Math.round(laborHours[currWeek][empGuid].accumlativeDeclaredTips / 100) / 100,
                    accumlativeChargedTips: Math.round(laborHours[currWeek][empGuid].accumlativeChargedTips / 100) / 100,
                    declaredTips: timeEntry.declaredCashTips,
                    chargedTips: timeEntry.nonCashTips,
                    grossFbSales: Math.round(grossFbSales / 100) / 100,
                    chargedSales: timeEntry.nonCashSales,
                    employeeServiceTips: Math.round(employeeServiceTips / 100) / 100,
                    indyTipsPaid: null,
                    tipsWithheld: timeEntry.tipsWithheld,
                    hourlyWage: timeEntry.hourlyWage,
                    timeclockSchedule: null
                };

                if (timeEntry.shiftReference?.guid) punch.timeclockSchedule = {
                    sequence: timeEntry.shiftReference?.guid
                }

                timeCardsObj[empGuid].employeePunches.push(punch);
            }
        }

        // pull & process jobs, employees, and shifts
        const [employees, jobs, shifts] = await Promise.all([
            toast.getAllEmployees(toastGuid, Object.keys(employeeGuids)),
            toast.getAllJobs(toastGuid, Object.keys(jobGuids)),
            toast.getAllShifts(toastGuid, Object.keys(shiftGuids))
        ]);
        
        //temp punch info
        const punchInfo = [];

        // update punches and calculate pay
        const tipCredit = ((wageInfo.minWage * 100) - (wageInfo.tippedMin * 100));
        for (const empGuid in timeCardsObj) {
            const tc = timeCardsObj[empGuid];
            
            // update employee
            tc.employeeFirstName = employees[tc.employeeSequence].firstName;
            tc.employeeLastName = employees[tc.employeeSequence].lastName;
            tc.employeeNumber = employees[tc.employeeSequence].externalEmployeeId;

            for (let i = 0; i < tc.employeePunches.length; i++) {
                const punch = tc.employeePunches[i];
                                
                // update job
                punch.job = jobs[punch.jobSequence].title;
                punch.jobNumber = jobs[punch.jobSequence].code;

                // update shift
                if (punch.timeclockSchedule) {
                    const shift = shifts[punch.timeclockSchedule.sequence];
                    punch.timeclockSchedule._id = `${punch._id}-${shift.guid}`,
                    punch.timeclockSchedule.laborDate = '';
                    punch.timeclockSchedule.jobSequence = shift.jobReference.guid;
                    punch.timeclockSchedule.jobNumber = jobs[shift.jobReference.guid].code;
                    punch.timeclockSchedule.clockInTime = shift.inDate;
                    punch.timeclockSchedule.clockOutTime = shift.outDate;
                    punch.scheduleConfig = shift.scheduleConfig;
                }

                // calculate pay, note: pay is scaled 100x larger that hours to minimize floating point math
                const isTipped = tippedJobs[punch.jobNumber];
                const regRate = ((punch.hourlyWage ?? 0) * 100) + (isTipped ? tipCredit : 0);
                const otRate = regRate * 1.5;
                
                let regPay = (punch.regularHours * 10000) * regRate;
                if (isTipped) regPay -= ((punch.regularHours * 10000) * tipCredit);
                punch.regularPay = Math.round(regPay / 10000) / 100;

                let otPay = (punch.overtimeHours * 10000) * otRate;
                if (isTipped) otPay -= ((punch.overtimeHours * 10000) * tipCredit);
                punch.overtimePay = Math.round(otPay / 10000) / 100;

                // punchInfo.push({
                //     'First Name': tc.employeeFirstName,
                //     'Last Name': tc.employeeLastName,
                //     'Tip Cred': isTipped ? tipCredit : 0,
                //     'Hrly Wage': punch.hourlyWage,
                //     'Reg Rate': regRate,
                //     'Reg Hrs': punch.regularHours,
                //     'Reg Pay': punch.regularPay,
                //     'OT Hrs': punch.overtimeHours,
                //     'OT Pay': punch.overtimePay
                // });
                
                // summary totals
                laborSummary.regularPay += regPay;
                laborSummary.overtimePay += otPay;
                if (regPay > 0) laborSummary.regularHours += (punch.regularHours * 10000);
                if (otPay > 0) laborSummary.overtimeHours += (punch.overtimeHours * 10000);
                laborSummary.regularRawHours += (punch.regularHours * 10000);
                laborSummary.overtimeRawHours += (punch.overtimeHours * 10000);
            }

            laborSummary.timeCards.push(tc);
        }

        //if (laborSummary._id == '024-2024-01-09-T') console.table(punchInfo);

        // summary totals back to decimal
        laborSummary.regularPay = Math.round(laborSummary.regularPay / 10000) / 100;
        laborSummary.overtimePay = Math.round(laborSummary.overtimePay / 10000) / 100;
        laborSummary.regularHours = Math.round(laborSummary.regularHours / 100) / 100;
        laborSummary.overtimeHours = Math.round(laborSummary.overtimeHours / 100) / 100;
        laborSummary.regularRawHours = Math.round(laborSummary.regularRawHours / 100) / 100;
        laborSummary.overtimeRawHours = Math.round(laborSummary.overtimeRawHours / 100) / 100;

        // temp save to file
        //fs.writeFileSync(`temp-toastLaborySummaryPull-${currDateString}.json`, JSON.stringify(laborSummary, null, 2));

        // save to database
        dbSaves.push(
            LaborSummary.findOneAndUpdate(
                { _id: laborSummary._id },
                laborSummary, 
                { upsert: true }
            )
        );

        console.log(
            laborSummary._id, '-', 
            laborSummary.timeCards.length, 'time cards, ', 
            laborSummary.regularPay , 'reg pay, ', 
            laborSummary.overtimePay , 'ot pay', 
            laborSummary.regularHours , 'reg hrs', 
            laborSummary.overtimeHours , 'ot hrs'
        );

        currDate.setUTCDate(currDate.getUTCDate() + 1);
        if (currDate.getUTCDay() === weekStart) { 
            currWeek = new Date(currDate);
            laborHours[currWeek] = {};
        }
    } while (currDate <= endDate);

    return Promise.allSettled(dbSaves);
}

const processAll = async (dateString, location, toast = toastApi) => {
    return Promise.allSettled([
        processOrders(dateString, location, toast),
        processTimeEntries(dateString, location, 3, toast)
    ]);
}

module.exports.processOrders = processOrders;
module.exports.processTimeEntries = processTimeEntries;
module.exports.run = processAll;