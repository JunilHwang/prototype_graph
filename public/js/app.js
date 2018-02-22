var bus = new Vue({
	data:{
		selectedData:0,
		nowData:[],
		graphPoint:null,
		graphData:[],
		graphLoading:false,
		graphNone:false,
		graphLen:0,
		units:[
			{name:'태양광 발전량',unit:' W'},
			{name:'온도',unit:' ℃'},
			{name:'AC 전압',unit:' V'},
			{name:'AC 전류',unit:' A'},
			{name:'AC 주파수',unit:' Hz'},
			{name:'DC 전압',unit:' V'},
			{name:'DC 전류',unit:' A'},
		],
		map:null,
		infowindow:{},
		prevwindow:false
	},
	computed:{
	},
	methods:{
		setPage:function(e){
			e.preventDefault();
		},
		getGraph:function(){
			var _this = this;
			var start_date = getNow(), end_date = getNow();
			var nowData = [];
			//var start_date = "2018-02-22", end_date = "2018-02-22";
			if($(".datepicker.start").length){
				start_date = $(".datepicker.start").val();
				end_date = $(".datepicker.end").val();
			}
			var start_time = (new Date(start_date)).getTime();
			var end_time = (new Date(end_date)).getTime();

			// 그래프 값 랜덤으로 집어넣기.
			var len = ((end_time-start_time)/(1000*60))+(60*24);
			len = len/10; // 그래프 로딩 속도 때문에 조정해놨음.
			_this.graphLen = len;
			var scores, rand, graphData = [];
			_this.graphLoading = false;
			for(var i=0; i<7; i++){
				scores = [];
				for(var j=0; j<len; j++){
					rand = Math.floor(Math.random()*100);
					scores.push(rand);
					if(j==len-1) nowData.push(rand);
				}
				var obj = {
					max:scores.reduce(function(a,b){ return Math.max(a,b)}),
					min:scores.reduce(function(a,b){ return Math.min(a,b)}),
					scores:scores
				}
				graphData.push(obj);
			}
			_this.graphLoading = true;
			bus.graphData = graphData;
			bus.nowData = nowData;
			graphCreate();
		}
	}
});

//app
function app(){
	return new Vue({
		el:"#app",
		data:{
			member:false
		},
		template:getTemplate('app'),
		components:site()
	})
}

function site(){
	var timer = setInterval(function(){
		bus.getGraph();
	}, 1000)
	return {
		'site-header':{
			template:getTemplate('site-header'),
			methods:{
				logout:function(e){
					e.preventDefault();
					$.get("./logout",null,function(data){
						alert('로그아웃 되었습니다.');
						bus.member = false;
					});
				}
			}
		},
		'content-01':{
			template:getTemplate('content-01'),
			data:function(){
				return {
					loading:true
				}
			}
		},
		'content-02':{
			template:getTemplate('content-02'),
			data:function(){
				return {
					start:getNow(),
					end:getNow(),
				}
			},
			methods:{
				active:function(index){
					bus.selectedData = index
					bus.getGraph();
				},
			},
			mounted:function(){
				$(".datepicker.start").datepicker();
				$(".datepicker.end").datepicker({"minDate":new Date()})
				$(".datepicker").val(getNow());
			}
		},
		'content-03':{
			template:getTemplate('content-03'),
			methods:{
				dataVal:function(data){
					return parseInt(parseFloat(data)*100)/100;
				},
				dateFormat:function(data){
					data = data.replace(/\-/gi,"/").slice(0,16);
					return data;
				}
			}
		},
	}
}

//Application Execute
app();

//get
function getTemplate(file,option){
	if(!option) option = null;
	$.ajax({
		type:'GET',
		url:'./public/component/'+file+'.html',
		data:option,
		async: false,
		success:function(data){
			text = data;
		}
	})
	return text;
}

function getDate( element ) {
	var date = null
	date = $.datepicker.parseDate( "yy-mm-dd", element.value );
	return date;
}

function getNow(){
	var date = new Date();
	var year = date.getFullYear();
	var month = date.getMonth()+1;
	var day = date.getDate();
	if(month < 10) month = "0"+month;
	var now = year+"-"+month+"-"+day;
	return now;
}

function graphCreate(){
	var canvas = document.getElementById('graph');
	canvas.width = $("#graph").width();
	canvas.height = $("#graph").height();
	var data = bus.graphData[bus.selectedData];
	var score = data.scores;
	var min = data.min,
		max = data.max,
		context = canvas.getContext('2d'),
		ratio = 1,
		move_left_by = 1,
		step = 1,
		width = canvas.width,
		height = canvas.height,
		renderData = [],
		renderTime = [];
	if(max != 0) if(height < max){
		ratio = max/height;
		height = max;
	} else {
		ratio = height/max;
	}

	//데이터의 갯수가 1440개(하루치 분량) 이하일 때 1:1 매치로 그래프를 그린다.
	if(score.length > 0) if(width >= score.length){
		move_left_by = width/score.length;
		width = score.length;
		var hours = 0, minutes = 0;
		for(var i=0,len=score.length;i<len;i++){
			renderData.push(score[i] - min); // 그래프가 최소값 부터 시작하도록 삽입
			renderTime.push(i); // 날짜 데이터 삽입
		}
	//데이터의 갯수가 1440개(하루치 분량) 이상일 때, 특정 구간의 평균 값으로 그래프를 그린다.
	} else {
		step = parseInt(score.length/width)+1;
		var avg, cnt;
		for(var i=0,len=score.length;i<len;i+=step){
			avg = cnt = 0
			for(var j=i;j<i+step;j++){ // 평균값 구하기
				if(!score[j]) break;
				avg += parseFloat(score[j]) ? parseFloat(score[j]) - min : 0;
				cnt++;
			}
			if(cnt != 0) avg = avg/cnt;
			renderData.push(avg); // 평균값 삽입
			renderTime.push(i); // 날짜 데이터 삽입
		}
		width = renderData.length;
	}
	if(canvas.width > width){
		move_left_by = canvas.width/width;
	}
	var plusHeight = canvas.height*0.1;
	context.fillStyle = '#f5f5f5';
	context.scale(0.9,0.85);
	context.translate(canvas.width*0.075, 0);
	var rowHeight = parseInt((canvas.height)/5);
	var statHeight = max/5;
	var commentMax = max+min;
	context.font = "15px Arial";
	context.fillStyle = "#666";
	for(var i=0;i<=5; i++){
		var row = canvas.height - (rowHeight*i) + plusHeight;
		var text = parseInt((min+(statHeight*i))*100)/100
		text += bus.units[bus.selectedData].unit;
		context.beginPath();
		context.moveTo(0,row);
		context.lineTo(canvas.width,row);
		context.strokeStyle = '#bebebe';
		context.lineWidth = 1;
		context.lineCap = 'round';
		context.stroke();
		context.fillText(text,-75,row+5);
	}
	var len=renderTime.length;
	var renderTime2 = [];
	var num = 0;
	var wr = parseInt(canvas.width/12);
	var plusStep = parseInt(len/12)+1; // 시간을 12개의 구간으로 분류함
	for(var i=0;i<=len;i+=plusStep){
		leftPoint = (wr*num++)+30;
		/* 실제 날짜 값을 삽입할 때 사용하는 부분
		var date = new Date(renderTime[i]);
		var month = date.getMonth()+1;
		var day = date.getDate();
		var hour = date.getHours();
		var minutes = date.getMinutes();
		var newDate;
		if(month < 10) month = "0"+month;
		if(day < 10) day = "0"+day;
		if(hour < 10) hour = "0"+hour;
		if(minutes < 10) minutes = "0"+minutes;
		newDate = month+"-"+day+" "+hour+":"+"00";
		if(len<700){
			newDate = month+"-"+day+" "+hour+":"+minutes;
		}
		context.fillText(newDate,leftPoint,canvas.height+plusHeight+25);*/
		context.fillText(i,leftPoint,canvas.height+plusHeight+25);
	}
	var left = 0,
		prev_stat = canvas.height - (renderData[0]*ratio) + plusHeight;
	for(var i=0,len=renderData.length;i<len;i++) {
		the_stat = canvas.height - (renderData[i]*ratio) + plusHeight;
		context.beginPath();
		context.moveTo(left, prev_stat);
		context.lineTo(left+move_left_by, the_stat);
		context.lineWidth = 3;
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.strokeStyle = '#339cd0';
		context.stroke();
		prev_stat = the_stat;
		left += move_left_by;
	}
}

function getColor(score){
	var color = 'color4';
	if(score <= 25){
		color = 'color1'
	} else if(score <= 50){
		color = 'color2'
	} else if(score <= 75){
		color = 'color3'
	}
	return color;
}

// Event Setting
$(document)
.on("click","a[href='#']",function(e){
	e.preventDefault();
})
.on("change",".datepicker",function(){
	var selectedDate = getDate(this);
	if($(this).hasClass("start")){
		$(".datepicker.end").datepicker("option","minDate",selectedDate);
	} else {
		$(".datepicker.start").datepicker("option","maxDate",selectedDate);
	}
})
.on("click",".gnb li",function(){
	var target = $(this).data("target");
	var _this = $(this);
	if($(target).length){
		var top = $(target).offset().top-120;
		$("html,body").stop().animate({
			scrollTop:top
		},1000)
	}
})
$.datepicker.setDefaults({
    dateFormat: 'yy-mm-dd',
    showMonthAfterYear: true,
    changeMonth:true,
    changeYear:true,
    maxDate:new Date()
})